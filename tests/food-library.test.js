import test from 'node:test';
import assert from 'node:assert/strict';
import {FOODS, nutrients, totals, validateEntry, readSaved} from '../src/nutrition.js';
import {FOOD_LIBRARY_KEY, foodCatalog, validateCustomFood, readFoodLibrary, saveCustomFood} from '../src/food-library.js';
function memoryStorage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}}
const draft={label:'全麦吐司',protein:'12.5',carb:'42',fat:'3.2'};
test('custom food persists independently of the daily log and contributes correct totals after reload',()=>{
  const storage=memoryStorage();
  const result=saveCustomFood(storage,draft),key=result.food.id;
  assert.equal(Object.keys(FOODS).length,16);
  const catalog=foodCatalog(readFoodLibrary(storage.getItem(FOOD_LIBRARY_KEY)));
  assert.equal(Object.keys(catalog).length,17);
  const record={...validateEntry(key,80,catalog),id:'record-one'};
  assert.deepEqual(nutrients(key,80,catalog),{protein:10,carb:33.6,fat:2.56});
  const raw=JSON.stringify({date:'2026-09-10',log:[record,{name:'燕麦片',grams:100,id:'old-record'}]});
  const saved=readSaved(raw,'2026-09-10',catalog);
  assert.equal(saved.issue,null);assert.equal(saved.log.length,2);
  assert.deepEqual(totals(saved.log,catalog),{protein:22,carb:88.80000000000001,fat:11.16});
  assert.deepEqual(readSaved(raw,'2026-09-11',catalog).log,[]);
  assert.equal(readFoodLibrary(storage.getItem(FOOD_LIBRARY_KEY))[0].label,'全麦吐司');
});
test('reject missing, negative, non-finite and out-of-range nutrient values; allow decimals and zero',()=>{
  for(const bad of ['', ' ', null, true, [], {}, -1, Infinity, NaN, 100.01, 'hello']){
    assert.throws(()=>validateCustomFood({...draft,protein:bad}));
  }
  assert.equal(validateCustomFood({...draft,protein:0}).protein,0);
  assert.equal(validateCustomFood({...draft,protein:'0.01'}).protein,.01);
  for(const label of ['', ' ', 'a'.repeat(61), null])assert.throws(()=>validateCustomFood({...draft,label}));
  assert.equal(validateCustomFood({...draft,label:'  全麦吐司  '}).label,'全麦吐司');
});
test('duplicate names cannot replace built-in or custom nutrition, including fresh additions from another tab',()=>{
  const storage=memoryStorage();
  for(const label of ['燕麦片',' 原味蛋白粉 ','蛋白粉_原味'])assert.throws(()=>saveCustomFood(storage,{...draft,label}),/已有/);
  const first=saveCustomFood(storage,draft);
  assert.throws(()=>saveCustomFood(storage,{...draft,label:' 全麦吐司 '}),/已有/);
  const second=saveCustomFood(storage,{...draft,label:'三文鱼'});
  assert.equal(second.foods.length,2);assert.equal(second.foods[0].id,first.food.id);
});
test('storage errors and corrupt libraries never report success or overwrite existing contents',()=>{
  const storage=memoryStorage();storage.setItem(FOOD_LIBRARY_KEY,'broken');
  assert.throws(()=>saveCustomFood(storage,draft),/原始数据已保留/);
  assert.equal(storage.getItem(FOOD_LIBRARY_KEY),'broken');
  const blocked={getItem:()=>null,setItem:()=>{throw new Error('QuotaExceededError')}};
  assert.throws(()=>saveCustomFood(blocked,draft),/未能保存/);
  for(const raw of ['{}','null','{"version":1,"foods":[null]}'])assert.throws(()=>readFoodLibrary(raw));
});
test('stored IDs cannot replace a built-in food or inject object keys',()=>{
  for(const id of ['燕麦片','__proto__','constructor']){
    assert.throws(()=>readFoodLibrary(JSON.stringify({version:1,foods:[{...draft,id}]})));
  }
});
