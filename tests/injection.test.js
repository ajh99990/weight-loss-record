import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleInjection,impactEnvelope} from '../src/injection.js';
const source={x:4,y:-2,z:0};
const meta={angle:1,radius:8,z:1,spread:1.4,delay:.2,duration:1.5,fromButton:true};
test('button particles start at the selected source, gather into the core and expire',()=>{
  const out=new Float32Array(4);
  assert.equal(sampleInjection(meta,.1,source,out)[3],0);
  sampleInjection(meta,.2,source,out);assert.equal(out[0],source.x);assert.equal(out[1],source.y);
  sampleInjection(meta,1,source,out);assert.ok(out[3]>0);assert.ok(Math.hypot(...out.slice(0,3))<Math.hypot(source.x,source.y));
  sampleInjection(meta,1.69999,source,out);assert.ok(Math.hypot(...out.slice(0,3))<.02);
  assert.equal(sampleInjection(meta,1.71,source,out)[3],0);
});
test('both streams stay finite across a complete injection including inactive tails',()=>{
  const out=new Float32Array(4);
  for(const fromButton of [true,false])for(let age=-.1;age<4;age+=.017){sampleInjection({...meta,fromButton},age,source,out);assert.ok(out.every(Number.isFinite));assert.ok(out[3]>=0&&out[3]<=1)}
});
test('impact occurs after gathering starts and decays without repeated flashes',()=>{
  assert.equal(impactEnvelope(.9),0);assert.ok(impactEnvelope(1.31)>.99);
  assert.ok(impactEnvelope(2)<impactEnvelope(1.4));assert.ok(impactEnvelope(5)<.0002);
});
