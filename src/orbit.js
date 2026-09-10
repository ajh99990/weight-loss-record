import * as THREE from 'three';
import { sampleInjection, impactEnvelope } from './injection.js';
import { QUALITY_LEVELS, createQualityController, createRenderScheduler, renderPixelRatio } from './graphics-quality.js';
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
export function createOrbit(host,{reduced=false,immersive=false,background=false,quality='auto',onQuality=()=>{},onSelect=()=>{},onFailure=()=>{},onModelFailure=()=>{}}={}){
  const qualityController=createQualityController({cores:navigator.hardwareConcurrency||0,memory:navigator.deviceMemory||0,coarse:matchMedia('(pointer: coarse)').matches},quality);
  let tier=qualityController.tier,config=QUALITY_LEVELS[tier],composer=null,bloom=null,scheduler=null,modelLoadedAt=null,settleUntil=0;
  const modelMeshes=[],energyMeshes=[],shellMaterials=new Set();
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,powerPreference:'default'});
  renderer.setPixelRatio(renderPixelRatio(tier,host.clientWidth,host.clientHeight,window.devicePixelRatio));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.88;
  renderer.setClearColor(0x000000,0);
  const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');canvas.className='orbit-canvas';host.appendChild(canvas);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,30);camera.position.set(0,0,8.2);
  const controls=immersive?new OrbitControls(camera,canvas):null;
  if(controls){controls.enableDamping=true;controls.dampingFactor=.06;controls.enablePan=false;controls.minDistance=5.8;controls.maxDistance=13;controls.autoRotate=true;controls.autoRotateSpeed=.6;controls.rotateSpeed=.45;controls.zoomSpeed=.6;}
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.8;room.dispose();pmrem.dispose();
  scene.add(new THREE.AmbientLight('#bcd6b0',.7));
  const key=new THREE.DirectionalLight('#f4ffd9',3);key.position.set(-3,4,5);scene.add(key);
  const rim=new THREE.DirectionalLight('#c4ffc0',2);rim.position.set(4,-2,2);scene.add(rim);
  const blue=new THREE.PointLight('#9dc8ff',15,10);blue.position.set(-2,-1,2);scene.add(blue);
  const sculpture=new THREE.Group();scene.add(sculpture);sculpture.position.x=immersive?0:.25;
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
  for(let i=0;i<480;i++){
    const a=random()*TAU,r=2.5+random()*6;
    particlePositions.push(Math.cos(a)*r,Math.sin(a)*r*.70,(random()-.5)*3);
    const c=new THREE.Color(i%3===0?'#cefc68':i%3===1?'#88bdff':'#ff9b76');particleColors.push(c.r,c.g,c.b);
  }
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3));particleGeo.setAttribute('color',new THREE.Float32BufferAttribute(particleColors,3));
  const particleMat=new THREE.PointsMaterial({size:.021,vertexColors:true,transparent:true,opacity:.5,depthWrite:false});
  const particles=new THREE.Points(particleGeo,particleMat);sculpture.add(particles);
  const reactor=new THREE.Group();sculpture.add(reactor);
  reactor.rotation.set(.25,.2,-.1);
  function applyModelQuality(){
    for(const material of shellMaterials){
      const hadTransmission=material.transmission>0;
      material.transmission=config.transmission?.72:0;
      material.opacity=config.transmission?1:tier==='low'?.15:.26;
      material.transparent=!config.transmission;material.roughness=config.transmission?.12:.25;
      if(hadTransmission!==config.transmission)material.needsUpdate=true;
    }
  }
  // Blender-authored crystal, mechanical ribs, gimbal rings and fasteners.
  new GLTFLoader().load('/models/fuel-core.glb',gltf=>{
    if(destroyed){gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});return}
    gltf.scene.traverse(o=>{if(o.isMesh){modelMeshes.push(o);o.userData.basePosition=o.position.clone();o.userData.baseScale=o.scale.clone();o.material.envMapIntensity=.85;if(o.material.name==='Fuel luminescence'){o.material.emissiveIntensity=.8;o.userData.isEnergy=true;energyMeshes.push(o);}if(o.material.name==='Optical shell'){shellMaterials.add(o.material);o.material.transmission=.72;o.material.thickness=.18;o.material.roughness=.12;}}});
    reactor.add(gltf.scene);applyModelQuality();modelLoadedAt=performance.now();qualityController.resetSampling();scheduler?.invalidate();
  },undefined,()=>{onModelFailure();modelLoadedAt=performance.now();scheduler?.invalidate();});
  const fragments=new THREE.Group();sculpture.add(fragments);
  const shardGeo=new THREE.OctahedronGeometry(.08,0);
  const shards=[];
  for(let i=0;i<42;i++){
    const color=SPECS[i%3].color,mat=new THREE.MeshPhysicalMaterial({color,metalness:.75,roughness:.18,emissive:color,emissiveIntensity:.08,transparent:true,opacity:.6});
    const shard=new THREE.Mesh(shardGeo,mat),angle=i/42*TAU,radius=2.6+(i%6)*.34;
    shard.scale.set(.45,.6+(i%4)*.35,.7);fragments.add(shard);shards.push({shard,angle,radius,phase:i*1.8});
  }
  const count=QUALITY_LEVELS.ultra.particles,streakCount=QUALITY_LEVELS.ultra.streaks;
  const flowGeo=new THREE.BufferGeometry(),flowPos=new Float32Array(count*3),flowColors=new Float32Array(count*3),flowAlpha=new Float32Array(count),flowSizes=new Float32Array(count);
  const flowMeta=[];
  for(let i=0;i<count;i++){
    flowMeta.push({angle:random()*TAU,radius:5+random()*6,z:(random()-.5)*5,spread:.3+random()*2,delay:random()*.65,duration:1.15+random()*.8,fromButton:i%5<3});
    const c=new THREE.Color(i%7===0?'#ffffff':SPECS[i%3].color);flowColors.set([c.r,c.g,c.b],i*3);flowSizes[i]=2+random()*5;
  }
  flowGeo.setAttribute('position',new THREE.BufferAttribute(flowPos,3).setUsage(THREE.DynamicDrawUsage));
  flowGeo.setAttribute('color',new THREE.BufferAttribute(flowColors,3));flowGeo.setAttribute('aAlpha',new THREE.BufferAttribute(flowAlpha,1).setUsage(THREE.DynamicDrawUsage));flowGeo.setAttribute('aSize',new THREE.BufferAttribute(flowSizes,1));
  const flowMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
    uniforms:{pixelRatio:{value:renderer.getPixelRatio()}},
    vertexShader:`attribute float aAlpha; attribute float aSize; uniform float pixelRatio; varying vec3 vColor; varying float vAlpha;
      void main(){vColor=color;vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*pixelRatio*8./max(1.,-mv.z),1.,24.);}`,
    fragmentShader:`varying vec3 vColor; varying float vAlpha;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float glow=pow(1.-r,1.5);gl_FragColor=vec4(vColor*(1.3+glow),glow*vAlpha);}`});
  const flow=new THREE.Points(flowGeo,flowMat);flow.frustumCulled=false;flow.visible=false;sculpture.add(flow);
  const streakPos=new Float32Array(streakCount*6),streakColors=new Float32Array(streakCount*6),streakGeo=new THREE.BufferGeometry();
  streakGeo.setAttribute('position',new THREE.BufferAttribute(streakPos,3).setUsage(THREE.DynamicDrawUsage));streakGeo.setAttribute('color',new THREE.BufferAttribute(streakColors,3).setUsage(THREE.DynamicDrawUsage));
  const streaks=new THREE.LineSegments(streakGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));streaks.frustumCulled=false;streaks.visible=false;sculpture.add(streaks);
  const source=new THREE.Vector3(4,-2,0),head=new Float32Array(4),tail=new Float32Array(4);
  const shocks=SPECS.map((spec,i)=>{
    const mesh=new THREE.Mesh(new THREE.RingGeometry(1,1.025+i*.006,160),new THREE.MeshBasicMaterial({color:spec.color,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    mesh.rotation.set(i*.2,-i*.14,0);sculpture.add(mesh);return mesh;
  });
  function disposeComposer(){
    if(!composer)return;
    for(const pass of composer.passes)pass.dispose?.();
    composer.dispose();composer=null;bloom=null;
  }
  function configurePostprocessing(){
    if(!config.bloom){disposeComposer();return;}
    if(composer)return;
    composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
    bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.3,.65,1.05);
    const setBloomSize=bloom.setSize.bind(bloom);
    bloom.setSize=(w,h)=>setBloomSize(Math.max(1,Math.round(w*config.bloomScale)),Math.max(1,Math.round(h*config.bloomScale)));
    composer.addPass(bloom);composer.addPass(new OutputPass());
  }
  const mouse=new THREE.Vector2(),pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
  const tracks=rings.map(r=>r.track);
  let active=-1,paused=reduced,visible=true,destroyed=false,time=0,burst=0,pulseAge=5,suspended=false,assembly=0,assemblyTarget=0;
  function resize(){
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    const dpr=renderPixelRatio(tier,width,height,window.devicePixelRatio);
    renderer.setPixelRatio(dpr);renderer.setSize(width,height);
    renderer.transmissionResolutionScale=.75;
    if(composer){composer.setPixelRatio(dpr);composer.setSize(width,height);}
    flowMat.uniforms.pixelRatio.value=dpr;
    camera.aspect=width/height;
    if(background){camera.position.z=width<700?7.4:6.35;sculpture.position.set(width<700?.15:-.08,.04,0);}
    else if(!immersive){camera.position.z=width<400?10.1:8.2;sculpture.position.x=width<400?.62:.9;}
    else if(width<600)camera.position.z=10.8;
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    qualityController.resetSampling();settleUntil=performance.now()+1500;scheduler?.reset();
  }
  function applyQuality(next){
    tier=next;config=QUALITY_LEVELS[tier];
    particleGeo.setDrawRange(0,config.stars);flowGeo.setDrawRange(0,config.particles);streakGeo.setDrawRange(0,config.streaks*2);
    shards.forEach(({shard},i)=>shard.visible=i<config.shards);
    configurePostprocessing();applyModelQuality();resize();onQuality(tier);
  }
  const ro=new ResizeObserver(resize);ro.observe(host);resize();
  const move=e=>{
    if(paused||suspended||document.hidden)return;
    const rect=background?{left:0,top:0,width:host.clientWidth,height:host.clientHeight}:host.getBoundingClientRect();
    mouse.set((e.clientX-rect.left)/Math.max(1,rect.width)*2-1,-((e.clientY-rect.top)/Math.max(1,rect.height)*2-1));pointer.copy(mouse);
    // The full-page background is not pickable. Avoid raycasting thousands of
    // triangles on every pointer event; selection is only needed on a click.
  };
  const leave=()=>pointer.set(0,0);
  const click=e=>{
    const rect=host.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);
    raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(tracks)[0];if(hit)onSelect(hit.object.userData.index);
  };
  const pointerSurface=background?window:host;pointerSurface.addEventListener('pointermove',move,{passive:true});pointerSurface.addEventListener('pointerleave',leave);if(!background)host.addEventListener('click',click);
  const lost=e=>{e.preventDefault();destroyed=true;scheduler?.dispose();onFailure();};canvas.addEventListener('webglcontextlost',lost);
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;qualityController.resetSampling();scheduler?.reset();});observer.observe(host);
  const visibilityChanged=()=>{qualityController.resetSampling();scheduler?.reset();};document.addEventListener('visibilitychange',visibilityChanged);
  const controlsChanged=()=>scheduler?.invalidate();controls?.addEventListener('change',controlsChanged);
  function animate(ms,interval){
    const started=performance.now(),dt=Math.min((interval??1000/config.fps)/1000,.1);
    if(!paused){time+=dt;pulseAge+=dt;}
    burst=paused?0:impactEnvelope(pulseAge);if(bloom)bloom.strength=.3+burst*(tier==='ultra'?1:.55);
    const lerp=paused?1:1-Math.exp(-dt*5);
    sculpture.rotation.y+=( (paused||immersive?0:pointer.x*.18)-sculpture.rotation.y)*lerp;
    sculpture.rotation.x+=( (paused||immersive?0:-pointer.y*.10)-sculpture.rotation.x)*lerp;
    sculpture.scale.setScalar(1+burst*.045);
    rings.forEach((ring,i)=>{
      ring.value=paused?ring.target:THREE.MathUtils.lerp(ring.value,ring.target,1-Math.exp(-dt*4));
      const progress=Math.min(1,Math.max(0,ring.value));
      ring.fill.geometry.setDrawRange(0,Math.floor(progress*240)*16*6);
      const angle=Math.PI/2-progress*TAU;ring.bead.position.set(Math.cos(angle)*ring.spec.r,Math.sin(angle)*ring.spec.r,0);
      ring.bead.visible=progress>.001;
      ring.group.rotation.x=ring.spec.x+(paused?0:Math.sin(time*.38+i*1.8)*(background?.48:immersive?.25:.12));
      ring.group.rotation.y=ring.spec.y+(paused?0:Math.cos(time*.29+i*2.1)*(background?.62:immersive?.35:.20));
      ring.tracer.rotation.z=paused?i*2.1:-time*(.22+i*.06)+i*2.1;
      ring.track.material.opacity+=( (active===i?.58:active>=0?.14:.30)-ring.track.material.opacity)*lerp;
      ring.fill.material.emissiveIntensity+=( (active===i?1.1:.45+burst*.7)-ring.fill.material.emissiveIntensity)*lerp;
    });
    reactor.rotation.y=time*.18;reactor.rotation.z=Math.sin(time*.3)*.10-.13;
    reactor.position.y=paused?0:Math.sin(time*.85)*.065;
    reactor.scale.setScalar((background?1.45:1.15)*(1+burst*.16));
    assembly+=(assemblyTarget-assembly)*(paused?1:lerp);
    for(const o of energyMeshes)o.material.emissiveIntensity=.8+burst*5;
    for(const o of modelMeshes){
      const base=o.userData.basePosition;
      if(o.name.startsWith('RIB')||o.name.startsWith('FASTENER'))o.position.copy(base).multiplyScalar(1+assembly*.7);
      if(o.name.startsWith('GIMBAL'))o.scale.copy(o.userData.baseScale).multiplyScalar(1+assembly*.32);
      if(o.name.startsWith('SHELL'))o.position.y=base.y+assembly*1.1;
      if(o.name.startsWith('COLLAR')){o.position.copy(base).multiplyScalar(1+assembly*.9);}
    }
    for(let i=0;i<config.shards;i++){const {shard,angle,radius,phase}=shards[i];const a=i/config.shards*TAU+time*.035;shard.position.set(Math.cos(a)*radius*(1+burst*.2),Math.sin(a)*radius*.82*(1+burst*.2),Math.sin(phase+time*.2)*.65);shard.rotation.set(time*.3+phase,time*.14,angle);}
    flow.visible=!paused&&pulseAge<2.7;streaks.visible=flow.visible&&config.streaks>0;
    if(flow.visible){
      for(let i=0;i<config.particles;i++){
        sampleInjection(flowMeta[i],pulseAge,source,head);
        flowPos[i*3]=head[0];flowPos[i*3+1]=head[1];flowPos[i*3+2]=head[2];flowAlpha[i]=head[3];
        if(i<config.streaks){
          sampleInjection(flowMeta[i],pulseAge-.055,source,tail);
          if(tail[3]===0)tail.set(head);
          const offset=i*6;
          for(let j=0;j<3;j++){streakPos[offset+j]=head[j];streakPos[offset+3+j]=tail[j];streakColors[offset+j]=flowColors[i*3+j]*head[3]*1.7;streakColors[offset+3+j]=flowColors[i*3+j]*head[3]*.07;}
        }
      }
      flowGeo.attributes.position.addUpdateRange(0,config.particles*3);flowGeo.attributes.position.needsUpdate=true;
      flowGeo.attributes.aAlpha.addUpdateRange(0,config.particles);flowGeo.attributes.aAlpha.needsUpdate=true;
      if(config.streaks){streakGeo.attributes.position.addUpdateRange(0,config.streaks*6);streakGeo.attributes.position.needsUpdate=true;streakGeo.attributes.color.addUpdateRange(0,config.streaks*6);streakGeo.attributes.color.needsUpdate=true;}

    }
    shocks.forEach((shock,i)=>{const age=pulseAge-1.22-i*.21;shock.visible=i<config.shocks&&!paused&&age>0&&age<1.5;shock.scale.setScalar(1+Math.max(0,age)*6);shock.material.opacity=shock.visible?Math.pow(1-age/1.5,2)*.85:0;});
    if(controls){controls.autoRotate=!paused;controls.update();}
    particles.rotation.z=paused?0:Math.sin(time*.05)*.1;
    particleMat.opacity=.3+burst*.5;
    try{
      if(composer)composer.render();else renderer.render(scene,camera);
      if(!paused&&modelLoadedAt!==null&&ms>modelLoadedAt+2000&&ms>settleUntil&&interval!==null){
        const change=qualityController.observe({frameMs:interval,renderMs:performance.now()-started,pulse:pulseAge<3});
        if(change)applyQuality(change.tier);
      }
    }catch{destroyed=true;scheduler?.dispose();onFailure();}
  }
  scheduler=createRenderScheduler({request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id),isVisible:()=>!destroyed&&visible&&!document.hidden&&!suspended,isPaused:()=>paused,fps:()=>config.fps,draw:animate});
  applyQuality(tier);
  return {
    setProgress(values){rings.forEach((r,i)=>r.target=Math.max(0,Number(values[i])||0));scheduler.invalidate();},
    pulse(origin){if(!paused){
      camera.updateMatrixWorld();sculpture.updateWorldMatrix(true,false);
      if(origin){const world=new THREE.Vector3(origin.x*2-1,1-origin.y*2,.5).unproject(camera);const direction=world.sub(camera.position).normalize();world.copy(camera.position).addScaledVector(direction,-camera.position.z/direction.z);source.copy(sculpture.worldToLocal(world));}
      else source.set(4,-2,0);
      pulseAge=0;scheduler.invalidate();
    }},
    setActive(index){if(active!==index){active=index;scheduler.invalidate();}},
    setPaused(value){paused=value;if(value)pulseAge=5;qualityController.resetSampling();scheduler.reset();},
    setSuspended(value){suspended=value;qualityController.resetSampling();scheduler.reset();if(!value)onQuality(tier);},
    setExploded(value){assemblyTarget=value?1:0;scheduler.invalidate();},
    setQuality(value){applyQuality(qualityController.setPreference(value));},
    zoom(amount){if(controls){camera.position.multiplyScalar(amount);camera.position.clampLength(controls.minDistance,controls.maxDistance);controls.update();scheduler.invalidate()}},
    reset(){pointer.set(0,0);sculpture.rotation.set(0,0,0);active=-1;scheduler.invalidate();if(controls){camera.position.set(0,0,host.clientWidth<600?10.8:8.2);controls.target.set(0,0,0);controls.update()}},
    dispose(){
      destroyed=true;scheduler.dispose();ro.disconnect();observer.disconnect();
      document.removeEventListener('visibilitychange',visibilityChanged);controls?.removeEventListener('change',controlsChanged);
      pointerSurface.removeEventListener('pointermove',move);pointerSurface.removeEventListener('pointerleave',leave);host.removeEventListener('click',click);canvas.removeEventListener('webglcontextlost',lost);
      const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const material of (Array.isArray(o.material)?o.material:[o.material]))materials.add(material);});
      for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
      controls?.dispose();env.dispose();disposeComposer();renderer.dispose();canvas.remove();
    }
  };
}
