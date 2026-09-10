export const GRAPHICS_KEY='food-tracker-graphics-quality';
export const QUALITY_LEVELS=Object.freeze({
  low:Object.freeze({label:'流畅',particles:160,streaks:0,stars:72,shards:6,shocks:1,dpr:.75,maxPixels:650000,fps:30,bloom:false,bloomScale:0,transmission:false}),
  balanced:Object.freeze({label:'均衡',particles:650,streaks:100,stars:180,shards:16,shocks:2,dpr:1,maxPixels:1300000,fps:60,bloom:true,bloomScale:.6,transmission:false}),
  ultra:Object.freeze({label:'最高',particles:2800,streaks:933,stars:480,shards:42,shocks:3,dpr:1.5,maxPixels:3200000,fps:60,bloom:true,bloomScale:1,transmission:true}),
});
export function readGraphicsPreference(value){return ['auto','low','balanced','ultra'].includes(value)?value:'auto';}
export function devicePolicy({cores=0,memory=0,coarse=false}={}){
  // Missing hints never imply a powerful GPU. Core counts only permit a trial;
  // actual frame timing must still qualify before automatic highest quality.
  if(coarse||(cores>0&&cores<=4)||(memory>0&&memory<=4))return {initial:'low',ceiling:'low'};
  return {initial:'balanced',ceiling:cores>=8&&(memory===0||memory>=8)?'ultra':'balanced'};
}
export function renderPixelRatio(tier,width,height,deviceDpr=1){
  const q=QUALITY_LEVELS[tier];
  return Math.min(Math.max(.1,deviceDpr||1),q.dpr,Math.sqrt(q.maxPixels/Math.max(1,width*height)));
}
export function createQualityController(hints={},preference='auto'){
  const policy=devicePolicy(hints);
  let mode=readGraphicsPreference(preference),tier=mode==='auto'?policy.initial:mode;
  let elapsed=0,cost=0,frames=0,hadPulse=false,badWindows=0,goodWindows=0,promoted=false;
  function resetWindow(){elapsed=cost=frames=0;hadPulse=false;}
  function resetSampling(){resetWindow();badWindows=goodWindows=0;}
  return {
    get tier(){return tier;},get preference(){return mode;},
    setPreference(value){mode=readGraphicsPreference(value);tier=mode==='auto'?policy.initial:mode;promoted=false;resetSampling();return tier;},
    resetSampling,
    observe({frameMs,renderMs,pulse=false}){
      if(mode!=='auto'||!Number.isFinite(frameMs)||frameMs<=0||frameMs>1000||(!Number.isFinite(renderMs)||renderMs<0))return null;
      elapsed+=frameMs;cost+=renderMs;frames++;hadPulse ||= pulse;
      if(elapsed<2200||frames<8)return null;
      const fps=1000*frames/elapsed,averageCost=cost/frames,target=QUALITY_LEVELS[tier].fps;
      const overloaded=fps<target*.72||averageCost>1000/target*.85;
      badWindows=overloaded?badWindows+1:0;
      goodWindows=!hadPulse&&fps>=56&&averageCost<8?goodWindows+1:0;
      let next=tier;
      if(tier!=='low'&&(badWindows>=2||fps<target*.45))next=tier==='ultra'?'balanced':'low';
      else if(tier==='balanced'&&policy.ceiling==='ultra'&&!promoted&&goodWindows>=3){next='ultra';promoted=true;}
      resetWindow();
      if(next===tier)return null;
      // Never bounce back up after a downgrade. Re-enabling Auto starts a new trial.
      if(next!=='ultra')promoted=true;
      tier=next;badWindows=goodWindows=0;
      return {tier,fps:Math.round(fps)};
    }
  };
}
// Demand-driven scheduler: paused scenes draw only when their data or controls
// change. Hidden/offscreen/suspended scenes have no outstanding frame request.
export function createRenderScheduler({request,cancel,isVisible,isPaused,fps,draw}){
  let frame=null,last=null,nextDue=null,dirty=true,disposed=false;
  function schedule(){if(!disposed&&frame===null&&isVisible()&&(!isPaused()||dirty))frame=request(tick);}
  function tick(ms){
    frame=null;if(disposed||!isVisible())return;
    const period=1000/fps();
    if(nextDue!==null&&ms<nextDue-.8){schedule();return;}
    nextDue=nextDue===null||ms-nextDue>period?ms+period:nextDue+period;
    const interval=last===null?null:ms-last;last=ms;dirty=false;
    draw(ms,interval);schedule();
  }
  return {
    invalidate(){dirty=true;schedule();},
    reset(){last=nextDue=null;dirty=true;if(frame!==null){cancel(frame);frame=null;}schedule();},
    dispose(){disposed=true;if(frame!==null)cancel(frame);frame=null;},
  };
}
