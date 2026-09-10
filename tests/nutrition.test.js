import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GOALS,FOODS,dayKey,nutrients,totals,calories,readSaved,validateEntry,macroStatus,createRecordId} from '../src/nutrition.js';
import {registerNutritionTools} from '../src/webmcp.js';
import {ringGeometry} from '../src/orbit.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('all 16 foods preserve the original supplied nutrient data',()=>{
  const original=fs.readFileSync('reference/original.html','utf8');
  const source=original.match(/const foods = (\{[\s\S]*?\n          \});/)[1];
  const originalFoods=Function(`return (${source})`)();
  assert.equal(Object.keys(FOODS).length,16);
  for(const [name,data] of Object.entries(originalFoods))for(const key of ['protein','carb','fat'])assert.equal(FOODS[name][key],data[key]);
  assert.deepEqual(GOALS,{protein:140,carb:130,fat:55});
});
test('portions and aggregate totals use per-100g values exactly',()=>{
  const n=nutrients('燕麦片',50);assert.deepEqual(n,{protein:6,carb:27.6,fat:4.3});
  close(calories(n),173.1);assert.equal(calories(GOALS),1575);
  const sum=totals([{name:'燕麦片',grams:50},{name:'德亚高钙牛奶',grams:200}]);
  close(sum.protein,13);close(sum.carb,37.4);close(sum.fat,7.3);
});
test('deletion recomputes from remaining entries without rounding drift',()=>{
  let log=Array.from({length:300},()=>({name:'燕麦片',grams:.1}));
  for(let i=0;i<299;i++)log.splice(0,1);
  assert.deepEqual(totals(log),nutrients('燕麦片',.1));
  log.pop();assert.deepEqual(totals(log),{protein:0,carb:0,fat:0});
});
test('reject unknown food, invalid and non-positive portions',()=>{
  for(const value of [0,-10,'',NaN,Infinity,10001,'food',true,false,null,[],{}])assert.throws(()=>validateEntry('燕麦片',value));
  for(const name of ['__proto__','constructor','unknown',''])assert.throws(()=>validateEntry(name,100));
  assert.equal(validateEntry('燕麦片','0.5').grams,.5);
});
test('local date works across UTC midnight',()=>{
  const before=process.env.TZ;process.env.TZ='Asia/Shanghai';
  assert.equal(dayKey(new Date('2026-09-09T16:01:00Z')),'2026-09-10');
  assert.equal(dayKey(new Date('2026-09-09T15:59:59Z')),'2026-09-09');
  if(before)process.env.TZ=before;else delete process.env.TZ;
});
test('reload preserves legacy logs while ignoring stale cached totals',()=>{
  const raw=JSON.stringify({date:'2026-09-10',eaten:{protein:999},log:[{name:'燕麦片',grams:100}]});
  const saved=readSaved(raw,'2026-09-10');assert.equal(saved.issue,null);assert.equal(saved.log.length,1);
  assert.equal(totals(saved.log).protein,12);assert.ok(saved.log[0].id);
  assert.equal(readSaved(raw,'2026-09-11').log.length,0);
});
test('corrupt storage is detected instead of silently importing malformed entries',()=>{
  for(const raw of ['{',JSON.stringify({date:'2026-09-10',log:42}),JSON.stringify({date:'2026-09-10',log:[{name:'constructor',grams:100}]})]){
    const result=readSaved(raw,'2026-09-10');assert.ok(result.issue);assert.deepEqual(result.log,[]);
  }
});
test('under, exactly at, and over target remain distinct',()=>{
  assert.equal(macroStatus(12,140),'还差 128.0 g');
  assert.equal(macroStatus(140,140),'目标已达成');
  assert.equal(macroStatus(155,140),'超出 15.0 g');
});
test('3D track is finite, continuous, outward facing and accurately segmented',()=>{
  const g=ringGeometry(2,.1);assert.equal(g.index.count,240*16*6);
  const p=g.attributes.position,n=g.attributes.normal;
  for(const a of p.array)assert.ok(Number.isFinite(a));
  assert.ok(Math.abs(p.getY(0)-2.1)<1e-6);close(n.getY(0),1);
  for(let c=0;c<3;c++)close(p.array[c],p.array[240*17*3+c]);
  const a=g.index.array[0],b=g.index.array[1],c=g.index.array[2];
  const ab=[p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),p.getZ(b)-p.getZ(a)];
  const ac=[p.getX(c)-p.getX(a),p.getY(c)-p.getY(a),p.getZ(c)-p.getZ(a)];
  assert.ok(ab[2]*ac[0]-ab[0]*ac[2]>0);g.dispose();
});
test('real Blender GLB loads in Three.js with crystal, light and mechanical parts',async()=>{
  const data=fs.readFileSync('public/models/fuel-core.glb');
  const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
  assert.ok(meshes.length>25);assert.ok(meshes.some(o=>o.name.startsWith('HEART')));assert.ok(meshes.some(o=>o.name.startsWith('RIB')));
  const glass=meshes.find(o=>o.material.name==='Optical shell');assert.ok(glass?.material.isMeshPhysicalMaterial);assert.ok(glass.material.transmission>0);
  assert.ok(meshes.some(o=>o.material.name==='Fuel luminescence'&&o.material.emissiveIntensity>0));
  gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
});
test('WebMCP tools share read/add/remove actions; invalid inputs do not mutate state',async()=>{
  const registry=new Map();const context={registerTool:(tool,options)=>{registry.set(tool.name,tool);options.signal.addEventListener('abort',()=>registry.delete(tool.name))}};
  const log=[];
  const dispose=registerNutritionTools({read:()=>({log,totals:totals(log)}),add:(name,grams)=>{const entry={...validateEntry(name,grams),id:'test-food'};log.push(entry);return entry},remove:id=>log.splice(log.findIndex(x=>x.id===id),1)},context);
  assert.equal(registry.size,3);assert.equal(registry.get('read_daily_nutrition').annotations.readOnlyHint,true);
  const add=registry.get('add_food_record');assert.equal(add.annotations.readOnlyHint,false);
  const result=await add.execute({name:'燕麦片',grams:50});assert.equal(result.totals.protein,6);
  assert.equal(registry.get('read_daily_nutrition').execute().log.length,1);
  await assert.rejects(()=>add.execute({name:'燕麦片',grams:-20}));assert.equal(log.length,1);
  await assert.rejects(()=>registry.get('remove_food_record').execute({id:'missing'}));assert.equal(log.length,1);
  await registry.get('remove_food_record').execute({id:'test-food'});assert.equal(log.length,0);
  dispose();assert.equal(registry.size,0);
});

test('HTTP IP origins can add, reload and identify records without randomUUID',()=>{
  const httpCrypto={getRandomValues:globalThis.crypto.getRandomValues.bind(globalThis.crypto)};
  const log=Array.from({length:100},()=>({...validateEntry('燕麦片',50),id:createRecordId(httpCrypto)}));
  assert.equal(new Set(log.map(item=>item.id)).size,100);
  assert.match(log[0].id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  const restored=readSaved(JSON.stringify({date:dayKey(),log}));
  assert.equal(restored.issue,null);assert.equal(restored.log[0].id,log[0].id);
  assert.deepEqual(totals(restored.log),totals(log));
});
