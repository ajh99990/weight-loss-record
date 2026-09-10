import test from 'node:test';
import assert from 'node:assert/strict';
import {GOALS,calories,totals,macroStatus} from '../src/nutrition.js';
import {GOAL_SETTINGS_KEY,defaultGoalSettings,validateGoals,validateProfile,estimateTargets,readGoalSettings,saveGoalSettings,macrosWithGoals} from '../src/goals.js';
const profile={sex:'male',age:30,height:180,weight:75,activity:'sedentary',intention:'maintain',eligible:true};
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('existing users keep their original goals before configuring settings',()=>{
  assert.deepEqual(readGoalSettings(null),defaultGoalSettings());
  assert.deepEqual(readGoalSettings(null).goals,GOALS);
  assert.equal(calories(readGoalSettings(null).goals),1575);
});
test('manual targets persist independently of food logs and update every macro denominator',()=>{
  const db=storage();db.setItem('food-tracker','unchanged');db.setItem('food-tracker-custom-foods','unchanged');
  const saved=saveGoalSettings(db,{source:'manual',goals:{protein:'120.5',carb:'200',fat:'60'},profile:null});
  assert.equal(saved.goals.protein,120.5);
  assert.deepEqual(readGoalSettings(db.getItem(GOAL_SETTINGS_KEY)),saved);
  assert.equal(db.getItem('food-tracker'),'unchanged');assert.equal(db.getItem('food-tracker-custom-foods'),'unchanged');
  assert.deepEqual(macrosWithGoals(saved.goals).map(m=>m.goal),[120.5,200,60]);
  const eaten=totals([{name:'燕麦片',grams:100}]);
  assert.equal(macroStatus(eaten.protein,saved.goals.protein),'还差 108.5 g');
  assert.deepEqual(GOALS,{protein:140,carb:130,fat:55});
});
test('manual targets reject blank, zero and invalid denominators',()=>{
  for(const bad of [0,-1,NaN,Infinity,'', ' ',null,true,[],{},1001])assert.throws(()=>validateGoals({...GOALS,carb:bad}));
  assert.equal(validateGoals({...GOALS,fat:.1}).fat,.1);
});
test('Mifflin equations, activity factors, intentions and macro energy conversions agree',()=>{
  const male=estimateTargets(profile);
  assert.equal(male.restingEnergy,1730);assert.equal(male.maintenanceEnergy,2076);
  assert.deepEqual(male.goals,{protein:129.8,carb:233.6,fat:69.2});
  assert.equal(male.energy,Math.round(calories(male.goals)));
  const female=estimateTargets({...profile,sex:'female'});assert.equal(female.restingEnergy,1564);
  const active=estimateTargets({...profile,activity:'moderate'});assert.equal(active.maintenanceEnergy,2682);
  const lose=estimateTargets({...profile,intention:'lose'}),gain=estimateTargets({...profile,intention:'gain'});
  assert.equal(lose.adjustmentPercent,-10);assert.equal(gain.adjustmentPercent,10);
  assert.ok(Math.abs(lose.energy-2076*.9)<1);assert.ok(Math.abs(gain.energy-2076*1.1)<1);
  assert.ok(lose.energy<male.energy&&gain.energy>male.energy);
});
test('automatic targets cannot be supplied from stale or edited previews at save time',()=>{
  const db=storage();const updated={...profile,weight:80};
  const saved=saveGoalSettings(db,{source:'estimated',profile:updated,goals:{protein:1,carb:1,fat:1}});
  assert.deepEqual(saved.goals,estimateTargets(updated).goals);
  assert.deepEqual(readGoalSettings(db.getItem(GOAL_SETTINGS_KEY)).profile,updated);
});
test('auto estimation blocks unsupported profiles, underweight weight loss and low calorie results',()=>{
  for(const patch of [{age:17},{age:81},{age:30.5},{sex:''},{activity:'extreme'},{intention:'rapid'},{height:0},{weight:0},{eligible:false},{weight:true}])assert.throws(()=>estimateTargets({...profile,...patch}));
  assert.throws(()=>estimateTargets({...profile,height:180,weight:50,intention:'lose'}),/体重偏低/);
  assert.throws(()=>estimateTargets({...profile,sex:'female',age:75,height:150,weight:50,intention:'lose'}),/自动建议范围/);
  assert.throws(()=>estimateTargets({...profile,weight:300,height:230,activity:'active',intention:'gain'}),/自动建议范围/);
  assert.equal(validateProfile({...profile,age:'30',weight:'75.5'}).weight,75.5);
});
test('corrupt settings preserve source and failed writes do not return new settings',()=>{
  for(const raw of ['{','null','{}',JSON.stringify({version:1,source:'manual',goals:{...GOALS,carb:0}})])assert.throws(()=>readGoalSettings(raw),/原始数据已保留/);
  const db={setItem(){throw new Error('QuotaExceededError')}};
  assert.throws(()=>saveGoalSettings(db,{source:'manual',goals:GOALS,profile:null}),/目标未保存/);
});
