import {FOODS, MACROS, createRecordId} from './nutrition.js';

export const FOOD_LIBRARY_KEY = 'food-tracker-custom-foods';
const normalized = name => name.normalize('NFKC').toLocaleLowerCase().trim();
export function foodCatalog(customFoods = []) {
  return {...FOODS, ...Object.fromEntries(customFoods.map(food => [food.id, food]))};
}
export function validateCustomFood(input, catalog = FOODS) {
  if (!input || typeof input.label !== 'string' || !input.label.trim()) throw new Error('请填写食物名称');
  const label = input.label.trim();
  if (label.length > 60) throw new Error('食物名称最多 60 个字');
  if (Object.entries(catalog).some(([key, food]) => [key, food.label].some(name => normalized(name) === normalized(label)))) throw new Error('食物库里已有这个名称，请换一个更具体的名称');
  const food = {label, type:'custom', category:'我的食物'};
  for (const {key, name} of MACROS) {
    const raw = input[key];
    if (!['number', 'string'].includes(typeof raw) || String(raw).trim() === '') throw new Error(`请填写${name}，没有则填 0`);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${name}应为每 100 克食物中的克数，范围为 0–100`);
    food[key] = value;
  }
  return food;
}
export function readFoodLibrary(raw) {
  if (!raw) return [];
  try {
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || !Array.isArray(saved.foods)) throw new Error();
    const foods = [], ids = new Set();
    for (const entry of saved.foods) {
      if (!entry || typeof entry.id !== 'string' || !/^custom-[a-f0-9-]{36}$/.test(entry.id) || ids.has(entry.id)) throw new Error();
      const food = {...validateCustomFood(entry, foodCatalog(foods)), id:entry.id};
      ids.add(food.id); foods.push(food);
    }
    return foods;
  } catch { throw new Error('本地自定义食物库无法读取，原始数据已保留'); }
}
export function saveCustomFood(storage, input) {
  let foods;
  try { foods = readFoodLibrary(storage.getItem(FOOD_LIBRARY_KEY)); }
  catch (error) { throw new Error(error.message || '无法读取本地食物库'); }
  const food = {...validateCustomFood(input, foodCatalog(foods)), id:`custom-${createRecordId()}`};
  const next = [...foods, food];
  try { storage.setItem(FOOD_LIBRARY_KEY, JSON.stringify({version:1, foods:next})); }
  catch { throw new Error('未能保存到浏览器，请检查存储权限或可用空间后重试'); }
  return {food, foods:next};
}
