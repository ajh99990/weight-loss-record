// Allocation-free particle trajectory, shared by glowing heads and streak tails.
export function sampleInjection(meta, age, source, out) {
  const t = (age - meta.delay) / meta.duration;
  if (t < 0 || t >= 1) { out[0]=out[1]=out[2]=out[3]=0; return out; }
  const remain = Math.pow(1-t, .72);
  const angle = meta.angle + t*t*5.4;
  const radius = meta.radius * remain;
  const gather = Math.sin(t*Math.PI) * (meta.fromButton ? .75 : 1);
  if (meta.fromButton) {
    out[0]=source.x*remain + Math.cos(angle)*gather*meta.spread;
    out[1]=source.y*remain + Math.sin(angle)*gather*meta.spread;
    out[2]=source.z*remain + meta.z*gather;
  } else {
    out[0]=Math.cos(angle)*radius;
    out[1]=Math.sin(angle)*radius*.78;
    out[2]=meta.z*remain;
  }
  out[3]=Math.min(1,t*10)*Math.min(1,(1-t)*12);
  return out;
}
export function impactEnvelope(age) {
  const t=age-1.15;
  return t<0?0:Math.min(1,t/.16)*Math.exp(-Math.max(0,t-.16)*2.5);
}
