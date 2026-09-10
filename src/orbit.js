import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TAU=Math.PI*2;
const SPECS=[{r:2.06,tube:.115,color:'#cefc68',x:.20,y:-.20,z:.22},{r:1.70,tube:.095,color:'#88bdff',x:-.28,y:.20,z:.22},{r:1.34,tube:.078,color:'#ff9b76',x:.15,y:-.16,z:.22}];
// Angle-major indexing permits progress updates with setDrawRange, without
// reallocating geometry each frame. All three rings share the same 0..1 meaning.
export function ringGeometry(radius,tube,segments=240,sides=16){
  const positions=[],normals=[],uvs=[],indices=[];
  for(let i=0;i<=segments;i++){
    const angle=Math.PI/2-i/segments*TAU;
    for(let j=0;j<=sides;j++){
      const t=j/sides*TAU,radial=tube*Math.cos(t);
      positions.push((radius+radial)*Math.cos(angle),(radius+radial)*Math.sin(angle),tube*Math.sin(t));
      normals.push(Math.cos(t)*Math.cos(angle),Math.cos(t)*Math.sin(angle),Math.sin(t));
      uvs.push(i/segments,j/sides);
    }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
    const a=i*(sides+1)+j,b=(i+1)*(sides+1)+j;
    indices.push(a,a+1,b,b,a+1,b+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);g.computeBoundingSphere();
  return g;
}
export function createOrbit(host,{reduced=false,immersive=false,onSelect=()=>{},onFailure=()=>{},onModelFailure=()=>{}}={}){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.setClearColor(0x000000,0);
  const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');canvas.className='orbit-canvas';host.appendChild(canvas);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,30);camera.position.set(0,0,8.2);
  const controls=immersive?new OrbitControls(camera,canvas):null;
  if(controls){controls.enableDamping=true;controls.dampingFactor=.06;controls.enablePan=false;controls.minDistance=5.8;controls.maxDistance=13;controls.autoRotate=true;controls.autoRotateSpeed=.6;controls.rotateSpeed=.45;controls.zoomSpeed=.6;}
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=1.1;room.dispose();pmrem.dispose();
  scene.add(new THREE.AmbientLight('#bcd6b0',1.5));
  const key=new THREE.DirectionalLight('#f4ffd9',5);key.position.set(-3,4,5);scene.add(key);
  const rim=new THREE.DirectionalLight('#c4ffc0',3);rim.position.set(4,-2,2);scene.add(rim);
  const blue=new THREE.PointLight('#9dc8ff',15,10);blue.position.set(-2,-1,2);scene.add(blue);
  const sculpture=new THREE.Group();scene.add(sculpture);sculpture.position.x=immersive?0:.9;
  const rings=SPECS.map((spec,index)=>{
    const group=new THREE.Group();group.rotation.set(spec.x,spec.y,spec.z);sculpture.add(group);
    const geometry=ringGeometry(spec.r,spec.tube);
    const trackMaterial=new THREE.MeshPhysicalMaterial({color:spec.color,metalness:.65,roughness:.23,clearcoat:1,clearcoatRoughness:.1,emissive:spec.color,emissiveIntensity:.08,transparent:true,opacity:.30});
    const track=new THREE.Mesh(geometry,trackMaterial);group.add(track);track.userData.index=index;
    const fillGeometry=geometry.clone();fillGeometry.setDrawRange(0,0);
    const fillMaterial=new THREE.MeshPhysicalMaterial({color:spec.color,metalness:.25,roughness:.17,clearcoat:1,clearcoatRoughness:.1,emissive:spec.color,emissiveIntensity:.5});
    const fill=new THREE.Mesh(fillGeometry,fillMaterial);group.add(fill);
    const bead=new THREE.Mesh(new THREE.SphereGeometry(spec.tube*1.12,20,16),fillMaterial);bead.position.set(0,spec.r,0);group.add(bead);
    // Very thin tick marks stay anchored to the data scale as the rings move.
    const tickPositions=[];for(let i=0;i<60;i++){const a=Math.PI/2-i/60*TAU,l=i%5===0?.07:.03;tickPositions.push(Math.cos(a)*(spec.r+.17),Math.sin(a)*(spec.r+.17),0,Math.cos(a)*(spec.r+.17+l),Math.sin(a)*(spec.r+.17+l),0)}
    const tg=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(tickPositions,3));
    const ticks=new THREE.LineSegments(tg,new THREE.LineBasicMaterial({color:spec.color,transparent:true,opacity:.16}));group.add(ticks);
    const tracer=new THREE.Mesh(ringGeometry(spec.r+.007,.012),new THREE.MeshBasicMaterial({color:spec.color,transparent:true,opacity:.75}));tracer.geometry.setDrawRange(0,14*16*6);group.add(tracer);
    return {group,track,fill,bead,tracer,spec,value:0,target:0};
  });
  const particlePositions=[],particleColors=[];
  let seed=17;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
  for(let i=0;i<100;i++){
    const a=random()*TAU,r=2.5+random()*1.7;
    particlePositions.push(Math.cos(a)*r,Math.sin(a)*r*.70,(random()-.5)*3);
    const c=new THREE.Color(i%3===0?'#cefc68':i%3===1?'#88bdff':'#ff9b76');particleColors.push(c.r,c.g,c.b);
  }
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3));particleGeo.setAttribute('color',new THREE.Float32BufferAttribute(particleColors,3));
  const particleMat=new THREE.PointsMaterial({size:.016,vertexColors:true,transparent:true,opacity:.5,depthWrite:false});
  const particles=new THREE.Points(particleGeo,particleMat);sculpture.add(particles);
  const reactor=new THREE.Group();sculpture.add(reactor);
  reactor.rotation.set(.25,.2,-.1);
  // Blender-authored crystal, mechanical ribs, gimbal rings and fasteners.
  new GLTFLoader().load('/models/fuel-core.glb',gltf=>{
    if(destroyed){gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});return}
    gltf.scene.traverse(o=>{if(o.isMesh){o.userData.basePosition=o.position.clone();o.userData.baseScale=o.scale.clone();o.material.envMapIntensity=.85;if(o.material.name==='Fuel luminescence'){o.material.emissiveIntensity=1.4;o.userData.isEnergy=true;}if(o.material.name==='Optical shell'){o.material.transmission=.72;o.material.thickness=.18;o.material.roughness=.12;}}});
    reactor.add(gltf.scene);
  },undefined,onModelFailure);
  const fragments=new THREE.Group();sculpture.add(fragments);
  const shardGeo=new THREE.OctahedronGeometry(.08,0);
  const shards=[];
  for(let i=0;i<18;i++){
    const color=SPECS[i%3].color,mat=new THREE.MeshPhysicalMaterial({color,metalness:.75,roughness:.18,emissive:color,emissiveIntensity:.08,transparent:true,opacity:.6});
    const shard=new THREE.Mesh(shardGeo,mat),angle=i/18*TAU,radius=2.5+(i%3)*.20;
    shard.scale.set(.45,.6+(i%4)*.35,.7);fragments.add(shard);shards.push({shard,angle,radius,phase:i*1.8});
  }
  const flowGeo=new THREE.BufferGeometry(),flowPos=new Float32Array(180*3),flowColors=new Float32Array(180*3);
  const flowMeta=[];for(let i=0;i<180;i++){const a=random()*TAU,r=3+random()*2,z=(random()-.5)*3;flowMeta.push([a,r,z]);const c=new THREE.Color(SPECS[i%3].color);flowColors.set([c.r,c.g,c.b],i*3)}
  flowGeo.setAttribute('position',new THREE.BufferAttribute(flowPos,3));flowGeo.setAttribute('color',new THREE.BufferAttribute(flowColors,3));
  const flowMat=new THREE.PointsMaterial({size:.033,vertexColors:true,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  const flow=new THREE.Points(flowGeo,flowMat);sculpture.add(flow);
  const shock=new THREE.Mesh(new THREE.RingGeometry(1,1.013,120),new THREE.MeshBasicMaterial({color:'#cefc68',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));sculpture.add(shock);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(512,400),.42,.5,.9);composer.addPass(bloom);composer.addPass(new OutputPass());
  const mouse=new THREE.Vector2(),pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
  let active=-1,paused=reduced,visible=true,destroyed=false,frame,last=0,time=0,burst=0,pulseAge=5,suspended=false,assembly=0,assemblyTarget=0;
  const resize=()=>{const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;renderer.setSize(width,height);composer.setSize(width,height);camera.aspect=width/height;if(!immersive){camera.position.z=width<400?10.1:8.2;sculpture.position.x=width<400?.62:.9;}else if(width<600)camera.position.z=10.8;camera.updateProjectionMatrix()};
  const ro=new ResizeObserver(resize);ro.observe(host);resize();
  const move=e=>{const rect=host.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height*2-1));raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(rings.map(r=>r.track))[0];canvas.style.cursor=hit?'pointer':'grab';pointer.copy(mouse)};
  const leave=()=>{pointer.set(0,0);canvas.style.cursor='grab'};
  const click=()=>{raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(rings.map(r=>r.track))[0];if(hit)onSelect(hit.object.userData.index)};
  host.addEventListener('pointermove',move);host.addEventListener('pointerleave',leave);host.addEventListener('click',click);
  const lost=e=>{e.preventDefault();onFailure();};canvas.addEventListener('webglcontextlost',lost);
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true});observer.observe(host);
  function animate(ms){
    if(destroyed)return;frame=requestAnimationFrame(animate);const dt=Math.min((ms-last)/1000||0,.05);last=ms;
    if(!visible||document.hidden||suspended)return;
    if(!paused)time+=dt;
    burst*=Math.exp(-dt*2.4);if(!paused)pulseAge+=dt;
    const lerp=1-Math.exp(-dt*5);
    sculpture.rotation.y+=( (paused||immersive?0:pointer.x*.18)-sculpture.rotation.y)*lerp;
    sculpture.rotation.x+=( (paused||immersive?0:-pointer.y*.10)-sculpture.rotation.x)*lerp;
    sculpture.scale.setScalar(1+burst*.025);
    rings.forEach((ring,i)=>{
      ring.value=paused?ring.target:THREE.MathUtils.lerp(ring.value,ring.target,1-Math.exp(-dt*4));
      const progress=Math.min(1,Math.max(0,ring.value));
      ring.fill.geometry.setDrawRange(0,Math.floor(progress*240)*16*6);
      const angle=Math.PI/2-progress*TAU;ring.bead.position.set(Math.cos(angle)*ring.spec.r,Math.sin(angle)*ring.spec.r,0);
      ring.bead.visible=progress>.001;
      ring.group.rotation.x=ring.spec.x+(paused?0:Math.sin(time*.38+i*1.8)*(immersive?.25:.12));
      ring.group.rotation.y=ring.spec.y+(paused?0:Math.cos(time*.29+i*2.1)*(immersive?.35:.20));
      ring.tracer.rotation.z=paused?i*2.1:-time*(.22+i*.06)+i*2.1;
      ring.track.material.opacity+=( (active===i?.58:active>=0?.14:.30)-ring.track.material.opacity)*lerp;
      ring.fill.material.emissiveIntensity+=( (active===i?1.1:.45+burst*.7)-ring.fill.material.emissiveIntensity)*lerp;
    });
    reactor.rotation.y=time*.18;reactor.rotation.z=Math.sin(time*.3)*.10-.13;
    reactor.position.y=paused?0:Math.sin(time*.85)*.065;
    reactor.scale.setScalar(1+burst*.11);
    assembly+=(assemblyTarget-assembly)*(paused?1:lerp);
    reactor.traverse(o=>{
      if(o.userData.isEnergy)o.material.emissiveIntensity=1.2+burst*2;
      const base=o.userData.basePosition;if(!base)return;
      if(o.name.startsWith('RIB')||o.name.startsWith('FASTENER'))o.position.copy(base).multiplyScalar(1+assembly*.7);
      if(o.name.startsWith('GIMBAL'))o.scale.copy(o.userData.baseScale).multiplyScalar(1+assembly*.32);
      if(o.name.startsWith('SHELL'))o.position.y=base.y+assembly*1.1;
      if(o.name.startsWith('COLLAR')){o.position.copy(base).multiplyScalar(1+assembly*.9);}
    });
    for(const {shard,angle,radius,phase} of shards){const a=angle+time*.035;shard.position.set(Math.cos(a)*radius,Math.sin(a)*radius*.82,Math.sin(phase+time*.2)*.65);shard.rotation.set(time*.3+phase,time*.14,angle);}
    const flight=Math.min(1,pulseAge/1.4);
    flowMat.opacity=pulseAge<1.4?Math.sin(flight*Math.PI)*.9:0;
    if(flowMat.opacity>0){for(let i=0;i<flowMeta.length;i++){const [a,r,z]=flowMeta[i],p=Math.max(0,1-flight);flowPos[i*3]=Math.cos(a+flight*2)*r*p;flowPos[i*3+1]=Math.sin(a+flight*2)*r*p;flowPos[i*3+2]=z*p}flowGeo.attributes.position.needsUpdate=true;}
    shock.scale.setScalar(1+pulseAge*1.8);shock.material.opacity=pulseAge<1.3?Math.max(0,.35-pulseAge*.28):0;
    if(controls){controls.autoRotate=!paused;controls.update();}
    particles.rotation.z=paused?0:Math.sin(time*.05)*.1;
    particleMat.opacity=.3+burst*.5;
    try{composer.render()}catch{onFailure();destroyed=true;cancelAnimationFrame(frame)}
  }
  frame=requestAnimationFrame(animate);
  return {
    setProgress(values){rings.forEach((r,i)=>r.target=Math.max(0,Number(values[i])||0));},
    pulse(){if(!paused){burst=1;pulseAge=0}},
    setActive(index){active=index},
    setPaused(value){paused=value},
    setSuspended(value){suspended=value},
    setExploded(value){assemblyTarget=value?1:0},
    zoom(amount){if(controls){camera.position.multiplyScalar(amount);camera.position.clampLength(controls.minDistance,controls.maxDistance);controls.update()}},
    reset(){pointer.set(0,0);sculpture.rotation.set(0,0,0);active=-1;if(controls){camera.position.set(0,0,host.clientWidth<600?10.8:8.2);controls.target.set(0,0,0);controls.update()}},
    dispose(){destroyed=true;cancelAnimationFrame(frame);ro.disconnect();observer.disconnect();host.removeEventListener('pointermove',move);host.removeEventListener('pointerleave',leave);host.removeEventListener('click',click);canvas.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())});controls?.dispose();env.dispose();composer.dispose();renderer.dispose();canvas.remove()}
  };
}
