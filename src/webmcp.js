export function registerNutritionTools({read,add,remove,afterUpdate=async()=>{}},context=typeof document==='undefined'?undefined:document.modelContext){
  if(!context?.registerTool)return()=>{};
  const lifecycle=new AbortController();
  const tools=[
    {name:'read_daily_nutrition',title:'查看今日营养',description:'Read today’s device-local food log, nutrient totals, goals, and available foods.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>JSON.parse(JSON.stringify(read()))},
    {name:'add_food_record',title:'记录食物',description:'Add one available food and its weight in grams to today’s visible nutrition log. This saves to this browser.',inputSchema:{type:'object',properties:{name:{type:'string'},grams:{type:'number',exclusiveMinimum:0,maximum:10000}},required:['name','grams'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{if(!input||typeof input.name!=='string'||typeof input.grams!=='number')throw new Error('name and numeric grams are required');const record=add(input.name,input.grams);await afterUpdate();return {record,totals:read().totals}}},
    {name:'remove_food_record',title:'删除食物记录',description:'Remove a specific food record by its ID from today’s visible log and save the updated totals.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{if(!input||typeof input.id!=='string'||!read().log.some(item=>item.id===input.id))throw new Error('Food record not found');remove(input.id);await afterUpdate();return {removed:input.id,totals:read().totals}}},
  ];
  for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}}
  return()=>lifecycle.abort();
}
