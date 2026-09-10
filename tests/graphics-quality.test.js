import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY_LEVELS,readGraphicsPreference,devicePolicy,renderPixelRatio,createQualityController,createRenderScheduler} from '../src/graphics-quality.js';

const strong={cores:12,memory:8,coarse:false};
function sample(controller,{seconds=8,fps=60,cost=4,pulse=false}={}){
  const changes=[];
  for(let i=0;i<seconds*fps;i++){
    const change=controller.observe({frameMs:1000/fps,renderMs:cost,pulse});
    if(change)changes.push(change.tier);
  }
  return changes;
}
test('automatic startup is conservative even on strong hardware',()=>{
  assert.equal(devicePolicy(strong).initial,'balanced');
  assert.equal(devicePolicy(strong).ceiling,'ultra');
  assert.deepEqual(devicePolicy(),{initial:'balanced',ceiling:'balanced'});
  for(const hint of [{cores:4},{memory:4},{...strong,coarse:true}])assert.equal(devicePolicy(hint).initial,'low');
  assert.equal(readGraphicsPreference(null),'auto');
  assert.equal(readGraphicsPreference('invalid'),'auto');
  assert.equal(readGraphicsPreference('ultra'),'ultra');
});
test('pixel budget remains bounded on 4K retina displays',()=>{
  for(const tier of Object.keys(QUALITY_LEVELS)){
    const ratio=renderPixelRatio(tier,3840,2160,2);
    assert.ok(3840*2160*ratio**2<=QUALITY_LEVELS[tier].maxPixels+1);
    assert.ok(ratio<=QUALITY_LEVELS[tier].dpr);
    assert.ok(renderPixelRatio(tier,0,0,2)>0);
  }
  assert.equal(QUALITY_LEVELS.low.bloom,false);
  assert.equal(QUALITY_LEVELS.low.transmission,false);
  assert.equal(QUALITY_LEVELS.balanced.transmission,false);
  assert.ok(QUALITY_LEVELS.balanced.particles<QUALITY_LEVELS.ultra.particles/4);
});
test('highest automatic quality requires sustained performance plus hardware eligibility',()=>{
  const controller=createQualityController(strong);
  assert.deepEqual(sample(controller,{seconds:4}),[]);
  assert.deepEqual(sample(controller,{seconds:4}),['ultra']);
  assert.deepEqual(sample(createQualityController(),{seconds:20}),[]);
  assert.deepEqual(sample(createQualityController(strong),{seconds:20,pulse:true}),[]);
});
test('auto downgrades under sustained load and does not oscillate back upward',()=>{
  const controller=createQualityController(strong);
  sample(controller);
  assert.equal(controller.tier,'ultra');
  controller.resetSampling();
  assert.deepEqual(sample(controller,{seconds:5,fps:35,cost:20}),['balanced']);
  assert.deepEqual(sample(controller,{seconds:5,fps:35,cost:20}),['low']);
  assert.deepEqual(sample(controller,{seconds:20}),[]);
  assert.equal(controller.tier,'low');
  assert.equal(controller.setPreference('auto'),'balanced');
  assert.deepEqual(sample(controller),['ultra']);
});
test('severe stalls cause faster downgrade; one ordinary bad window does not',()=>{
  const severe=createQualityController(strong);
  assert.deepEqual(sample(severe,{seconds:2.5,fps:20,cost:20}),['low']);
  const transient=createQualityController(strong);
  assert.deepEqual(sample(transient,{seconds:2.3,fps:40,cost:10}),[]);
  sample(transient,{seconds:3});
  assert.equal(transient.tier,'balanced');
});
test('manual preferences bypass adaptation and sampling resets discard old measurements',()=>{
  const manual=createQualityController({cores:2},'ultra');
  assert.deepEqual(sample(manual,{seconds:20,fps:10,cost:100}),[]);
  assert.equal(manual.tier,'ultra');
  assert.equal(manual.setPreference('auto'),'low');
  const controller=createQualityController(strong);
  sample(controller,{seconds:2.3,fps:40,cost:16});
  controller.resetSampling();
  sample(controller,{seconds:2.3,fps:40,cost:16});
  assert.equal(controller.tier,'balanced');
  for(const frameMs of [NaN,0,-1,Infinity,10000])assert.equal(controller.observe({frameMs,renderMs:4}),null);
});
function harness({paused=false,visible=true,fps=60}={}){
  let id=0;const queue=new Map(),draws=[];
  const state={paused,visible,fps};
  const scheduler=createRenderScheduler({
    request:fn=>{queue.set(++id,fn);return id;},cancel:key=>queue.delete(key),
    isVisible:()=>state.visible,isPaused:()=>state.paused,fps:()=>state.fps,
    draw:(ms,interval)=>draws.push({ms,interval}),
  });
  return{state,scheduler,queue,draws,step(ms){const work=[...queue.values()];queue.clear();work.forEach(fn=>fn(ms));}};
}
test('paused scenes redraw once per change and coalesce redundant requests',()=>{
  const h=harness({paused:true});
  h.scheduler.invalidate();h.scheduler.invalidate();h.scheduler.invalidate();
  assert.equal(h.queue.size,1);h.step(0);
  assert.equal(h.draws.length,1);assert.equal(h.queue.size,0);
  h.scheduler.invalidate();h.step(2000);
  assert.equal(h.draws.length,2);assert.equal(h.queue.size,0);
});
test('30 FPS caps drawing on a 120 Hz screen; 60 FPS works on 144 Hz screens',()=>{
  for(const [fps,hz] of [[30,120],[60,144]]){
    const h=harness({fps});h.scheduler.reset();
    for(let i=0;i<hz;i++)h.step(i*1000/hz);
    assert.ok(Math.abs(h.draws.length-fps)<=1,`${h.draws.length} draws for ${fps} FPS`);
    h.scheduler.dispose();assert.equal(h.queue.size,0);
  }
});
test('hidden scenes cancel all rendering and discard the elapsed background time on resume',()=>{
  const h=harness();h.scheduler.reset();h.step(0);h.step(17);
  h.state.visible=false;h.scheduler.reset();assert.equal(h.queue.size,0);
  h.scheduler.invalidate();assert.equal(h.queue.size,0);
  h.state.visible=true;h.scheduler.reset();h.step(100000);
  assert.equal(h.draws.at(-1).interval,null);
  h.state.paused=true;h.scheduler.reset();h.step(100017);
  assert.equal(h.queue.size,0);
  h.scheduler.dispose();h.scheduler.invalidate();assert.equal(h.queue.size,0);
});
