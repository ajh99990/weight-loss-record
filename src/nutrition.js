export const GOALS = Object.freeze({ protein: 140, carb: 130, fat: 55 });
export const MACROS = [
  {key:'protein',name:'蛋白质',en:'PROTEIN',color:'#cefc68',goal:140},
  {key:'carb',name:'碳水化合物',en:'CARBS',color:'#88bdff',goal:130},
  {key:'fat',name:'脂肪',en:'FAT',color:'#ff9b76',goal:55},
];
// Per-100g values preserved verbatim from the user's original tracker.
export const FOODS = {
  蛋白粉_原味: { protein: 75, carb: 5.9, fat: 6.3, type:'protein',label:'原味蛋白粉',category:'蛋白补充' },
  蛋白粉_巧克力口味: { protein: 73, carb: 6.5, fat: 6.2,type:'protein',label:'巧克力蛋白粉',category:'蛋白补充' },
  蛋白粉_牛奶口味: { protein: 74, carb: 6.4, fat: 6.7,type:'protein',label:'牛奶蛋白粉',category:'蛋白补充' },
  蛋白粉_奶茶口味: { protein: 71, carb: 9.1, fat: 6,type:'protein',label:'奶茶蛋白粉',category:'蛋白补充' },
  燕麦片: { protein: 12, carb: 55.2, fat: 8.6,type:'grain',label:'燕麦片',category:'谷物主食' },
  腰果: { protein: 17.3, carb: 37.6, fat: 39.2,type:'nut',label:'腰果',category:'坚果零食' },
  德亚高钙牛奶: { protein: 3.5, carb: 4.9, fat: 1.5,type:'milk',label:'德亚高钙牛奶',category:'乳制品' },
  U形鸡胸奥尔良: { protein: 22.9, carb: 4.8, fat: 1.8,type:'meat',label:'U形鸡胸 · 奥尔良',category:'肉类蛋白' },
  U形鸡胸香草: { protein: 22.3, carb: 1.6, fat: 2.4,type:'meat',label:'U形鸡胸 · 香草',category:'肉类蛋白' },
  开心果冰淇淋: { protein: 6.7, carb: 21.1, fat: 13.8,type:'dessert',label:'开心果冰淇淋',category:'甜品' },
  欧包: { protein: 6, carb: 33.3, fat: 5.6,type:'grain',label:'欧包',category:'谷物主食' },
  南瓜泥: { protein: 5.3, carb: 22.8, fat: 13.8,type:'grain',label:'南瓜泥',category:'谷物主食' },
  面条: { protein: 60, carb: 60, fat: 30,type:'grain',label:'面条',category:'谷物主食' },
  舒芙蕾: { protein: 5.8, carb: 19.9, fat: 13,type:'dessert',label:'舒芙蕾',category:'甜品' },
  荔枝大福: { protein: 3.5, carb:36.8, fat:12.7,type:'dessert',label:'荔枝大福',category:'甜品' },
  悦鲜活牛奶: { protein: 3.6, carb:3, fat:3.9,type:'milk',label:'悦鲜活牛奶',category:'乳制品' }
};
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validateEntry(name, grams) {
  if (!Object.hasOwn(FOODS,name)) throw new Error('请选择食物');
  if(typeof grams!=='number'&&typeof grams!=='string') throw new Error('请输入有效的克数');
  const weight = Number(grams);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 10000) throw new Error('请输入 0 到 10,000 之间的克数');
  return {name,grams:weight};
}
export function nutrients(name, grams) {
  const entry = validateEntry(name,grams);
  return Object.fromEntries(MACROS.map(({key})=>[key,FOODS[name][key]*entry.grams/100]));
}
export function totals(log) {
  return log.reduce((sum,item)=>{
    const values = nutrients(item.name,item.grams);
    for(const {key} of MACROS) sum[key]+=values[key];
    return sum;
  },{protein:0,carb:0,fat:0});
}
export const calories = (n) => n.protein*4 + n.carb*4 + n.fat*9;
export function readSaved(raw,date=dayKey()) {
  if(!raw) return {log:[],issue:null};
  try {
    const parsed = JSON.parse(raw);
    if(parsed.date !== date) return {log:[],issue:null};
    if(!Array.isArray(parsed.log)) throw new Error('Invalid log');
    const log=parsed.log.map((item,index)=>({...validateEntry(item.name,item.grams),id:typeof item.id==='string'?item.id:`restored-${index}`,time:typeof item.time==='string'?item.time:''}));
    return {log,issue:null};
  } catch { return {log:[],issue:'保存的记录无法读取。原始数据已保留。'}; }
}
export function macroStatus(value,goal) {
  const delta=goal-value;
  return delta>0.05 ? `还差 ${delta.toFixed(1)} g` : delta< -0.05 ? `超出 ${(-delta).toFixed(1)} g` : '目标已达成';
}
