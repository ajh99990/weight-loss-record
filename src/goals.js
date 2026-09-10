import {GOALS, MACROS, calories} from './nutrition.js';

export const GOAL_SETTINGS_KEY = 'food-tracker-goal-settings';
export const ACTIVITY_LEVELS = Object.freeze([
  {key:'sedentary',label:'久坐为主 · 很少运动',factor:1.2},
  {key:'light',label:'轻度活动 · 每周运动 1–3 天',factor:1.375},
  {key:'moderate',label:'中度活动 · 每周运动 3–5 天',factor:1.55},
  {key:'active',label:'高活动量 · 多数天高强度运动或体力工作',factor:1.725},
]);
export const INTENTIONS = Object.freeze([
  {key:'maintain',label:'维持体重',factor:1},
  {key:'lose',label:'温和减脂',factor:.9},
  {key:'gain',label:'缓慢增重',factor:1.1},
]);
export function defaultGoalSettings(){return {version:1,source:'default',goals:{...GOALS},profile:null};}
function numberInRange(raw,min,max,message){
  if(!['number','string'].includes(typeof raw)||String(raw).trim()==='')throw new Error(message);
  const value=Number(raw);
  if(!Number.isFinite(value)||value<min||value>max)throw new Error(message);
  return value;
}
export function validateGoals(input){
  const goals={};
  for(const {key,name} of MACROS)goals[key]=numberInRange(input?.[key],.1,1000,`${name}目标需为 0.1–1,000 克`);
  return goals;
}
export function validateProfile(input){
  const age=numberInRange(input?.age,18,80,'自动估算仅支持 18–80 岁成年人，请使用专业人士给出的手动目标');
  if(!Number.isInteger(age))throw new Error('年龄请填写整数岁');
  const height=numberInRange(input?.height,120,230,'请填写 120–230 厘米的身高；范围外请使用个体化的手动目标');
  const weight=numberInRange(input?.weight,30,300,'请填写 30–300 千克的体重；范围外请使用个体化的手动目标');
  if(!['male','female'].includes(input?.sex))throw new Error('请选择公式使用的生理性别参数');
  if(!ACTIVITY_LEVELS.some(x=>x.key===input?.activity))throw new Error('请选择日常活动量');
  if(!INTENTIONS.some(x=>x.key===input?.intention))throw new Error('请选择体重目标');
  if(input?.eligible!==true)throw new Error('此估算不适用于孕哺期或需要特殊营养方案的情况，请使用专业人士给出的手动目标');
  return {age,height,weight,sex:input.sex,activity:input.activity,intention:input.intention,eligible:true};
}
// Mifflin–St Jeor (1990), then an approximate activity multiplier.
// +/-10% and the 25/45/30 energy split are explicit app starting-point choices,
// not a personalized prescription or a guaranteed rate of weight change.
export function estimateTargets(input){
  const profile=validateProfile(input);
  const bmi=profile.weight/((profile.height/100)**2);
  if(profile.intention==='lose'&&bmi<18.5)throw new Error('目前体重偏低，不提供减脂目标。请与医生或营养师确认合适的摄入量');
  const activity=ACTIVITY_LEVELS.find(x=>x.key===profile.activity);
  const intention=INTENTIONS.find(x=>x.key===profile.intention);
  const resting=10*profile.weight+6.25*profile.height-5*profile.age+(profile.sex==='male'?5:-161);
  const maintenance=resting*activity.factor;
  const target=maintenance*intention.factor;
  const floor=profile.sex==='male'?1500:1200;
  if(target<floor||target>6000)throw new Error(`估算约 ${Math.round(target)} kcal，超出本工具自动建议范围（${floor}–6,000 kcal）。请核对资料或使用专业人士给出的手动目标`);
  const round=n=>Math.round(n*10)/10;
  const goals={protein:round(target*.25/4),carb:round(target*.45/4),fat:round(target*.30/9)};
  return {profile,goals,restingEnergy:Math.round(resting),maintenanceEnergy:Math.round(maintenance),energy:Math.round(calories(goals)),activityFactor:activity.factor,adjustmentPercent:Math.round((intention.factor-1)*100)};
}
export function readGoalSettings(raw){
  if(!raw)return defaultGoalSettings();
  try{
    const saved=JSON.parse(raw);
    if(saved.version!==1||!['manual','estimated'].includes(saved.source))throw new Error();
    const goals=validateGoals(saved.goals);
    const profile=saved.profile?validateProfile(saved.profile):null;
    if(saved.source==='estimated'&&!profile)throw new Error();
    return {version:1,source:saved.source,goals,profile};
  }catch{throw new Error('本地目标设置无法读取，原始数据已保留；可以重新设置目标');}
}
export function saveGoalSettings(storage,{source,goals,profile}){
  if(!['manual','estimated'].includes(source))throw new Error('请选择目标设置方式');
  // Recompute automatic targets at save time so a stale preview cannot be applied.
  const estimate=source==='estimated'?estimateTargets(profile):null;
  const settings={version:1,source,goals:estimate?estimate.goals:validateGoals(goals),profile:profile?validateProfile(profile):null};
  try{storage.setItem(GOAL_SETTINGS_KEY,JSON.stringify(settings));}
  catch{throw new Error('目标未保存，请检查浏览器存储权限或可用空间后重试');}
  return settings;
}
export function macrosWithGoals(goals){return MACROS.map(m=>({...m,goal:goals[m.key]}));}
