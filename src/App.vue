<script setup>
import {ref,computed,onMounted,onBeforeUnmount,nextTick,watch} from 'vue';
import {ArrowUpRight,ArrowRight,Plus,Minus,Check,Trash2,Flame,ChevronDown,ScanLine,Leaf,Milk,Wheat,Beef,Nut,IceCreamBowl,Zap,RotateCcw,MoveUpRight,VolumeX,Pause,Play,Expand,X,SlidersHorizontal} from 'lucide-vue-next';
import OrbitScene from './OrbitScene.vue';
import GraphicsQuality from './GraphicsQuality.vue';
import {GRAPHICS_KEY,readGraphicsPreference} from './graphics-quality';
import AnimatedNumber from './AnimatedNumber.vue';
import GoalSettings from './GoalSettings.vue';
import {GOAL_SETTINGS_KEY,defaultGoalSettings,readGoalSettings,macrosWithGoals} from './goals';
import {registerNutritionTools} from './webmcp';
import {FOOD_LIBRARY_KEY,foodCatalog,readFoodLibrary,saveCustomFood} from './food-library';
import {FOODS,dayKey,nutrients,totals,calories,readSaved,macroStatus,validateEntry,createRecordId} from './nutrition';
const graphicsPreference=ref('auto'),graphicsTier=ref('balanced');
function readGraphics(){try{graphicsPreference.value=readGraphicsPreference(localStorage.getItem(GRAPHICS_KEY));}catch{graphicsPreference.value='auto';}}
function changeGraphics(value){graphicsPreference.value=value;try{localStorage.setItem(GRAPHICS_KEY,value);}catch{notify('画质已切换，本次设置暂未保存');}}
const goalSettings=ref(defaultGoalSettings()),goalsDialog=ref(null),goalsIssue=ref('');
const macros=computed(()=>macrosWithGoals(goalSettings.value.goals));
function readGoals(){try{goalSettings.value=readGoalSettings(localStorage.getItem(GOAL_SETTINGS_KEY));goalsIssue.value='';}catch(e){goalsIssue.value=e.message;}}
function applyGoals(settings){goalSettings.value=settings;goalsIssue.value='';notify('每日目标已更新');}
const activeMacro=ref(-1),revision=ref(0),immersive=ref(false),labDialog=ref(null);
const backgroundScene=ref(null),recordButton=ref(null),injection=ref(null),motionPaused=ref(false);
function injectEnergy(){const rect=recordButton.value?.getBoundingClientRect();injection.value={id:++revision.value,origin:rect?{x:Math.max(0,Math.min(1,(rect.left+rect.width/2)/window.innerWidth)),y:Math.max(0,Math.min(1,(rect.top+rect.height/2)/window.innerHeight))}:null};}
let labOpener,previousOverflow;
async function openLab(){labOpener=document.activeElement;previousOverflow=document.body.style.overflow;immersive.value=true;await nextTick();document.body.style.overflow='hidden';labDialog.value.showModal()}
function closeLab(){immersive.value=false;document.body.style.overflow=previousOverflow??'';activeMacro.value=-1;labOpener?.focus()}
const log=ref([]), selected=ref('燕麦片'), grams=ref(100), date=ref(dayKey()), message=ref(''), error=ref(''), saveIssue=ref('');
const customFoods=ref([]),libraryIssue=ref(''),foodDialog=ref(null),foodNameInput=ref(null),customFoodError=ref('');
const foodDraft=ref({label:'',protein:'',carb:'',fat:''});
const foods=computed(()=>foodCatalog(customFoods.value));
let foodDialogOpener,foodDialogOverflow,focusFoodWeight=false;
function openFoodDialog(){focusFoodWeight=false;foodDialogOpener=document.activeElement;foodDialogOverflow=document.body.style.overflow;foodDraft.value={label:'',protein:'',carb:'',fat:''};customFoodError.value='';foodDialog.value.showModal();document.body.style.overflow='hidden';foodNameInput.value?.focus()}
function closeFoodDialog(){document.body.style.overflow=foodDialogOverflow??'';if(focusFoodWeight)document.getElementById('grams')?.focus();else foodDialogOpener?.focus()}
async function addCustomFood(){
  try {
    const result=saveCustomFood(localStorage,foodDraft.value);
    customFoods.value=result.foods;libraryIssue.value='';selected.value=result.food.id;error.value='';
    focusFoodWeight=true;foodDialog.value.close();notify(`已添加 ${result.food.label}，填写份量即可记录`);
    await nextTick();document.getElementById('grams')?.focus();
  } catch(e){customFoodError.value=e.message}
}
const foodIcons={custom:Leaf,protein:Zap,milk:Milk,grain:Wheat,meat:Beef,nut:Nut,dessert:IceCreamBowl};
const eaten=computed(()=>totals(log.value,foods.value));
const energy=computed(()=>Math.round(calories(eaten.value)));
const targetEnergy=computed(()=>Math.round(calories(goalSettings.value.goals)));
const selectedFood=computed(()=>foods.value[selected.value] || FOODS.燕麦片);
const preview=computed(()=>{try{return nutrients(selected.value,grams.value,foods.value)}catch{return {protein:0,carb:0,fat:0}}});
const finished=computed(()=>macros.value.filter(m=>eaten.value[m.key]>=m.goal).length);
const dateLabel=computed(()=>new Date(`${date.value}T12:00:00`).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}));
const reversedLog=computed(()=>[...log.value].reverse());
const format=(n)=>Number(n.toFixed(1)).toLocaleString('en-US',{maximumFractionDigits:1});
let notifyTimer,midnightTimer,unregisterTools;
function notify(text){message.value=text;clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>message.value='',3500)}
function read(){try{customFoods.value=readFoodLibrary(localStorage.getItem(FOOD_LIBRARY_KEY));libraryIssue.value='';if(!Object.hasOwn(foods.value,selected.value))selected.value='燕麦片';}catch(e){libraryIssue.value=e.message}try{const data=readSaved(localStorage.getItem('food-tracker'),date.value,foods.value);log.value=data.log;saveIssue.value=data.issue||'';if(data.issue){try{localStorage.setItem('food-tracker-backup',localStorage.getItem('food-tracker'))}catch{}}}catch{saveIssue.value='浏览器未允许保存，当前记录仅保留到关闭页面。'}}
function rollover(){const today=dayKey();if(today!==date.value){date.value=today;log.value=[];read();notify('新的一天，重新记录每一口。')}}
function persist(){try{localStorage.setItem('food-tracker',JSON.stringify({date:date.value,eaten:eaten.value,log:log.value}));saveIssue.value=''}catch{saveIssue.value='保存失败，请保持此页面打开。'}}
function recordFood(name,weight){rollover();const item=validateEntry(name,weight,foods.value);log.value.push({...item,id:createRecordId(),time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})});persist();injectEnergy();error.value='';notify(`已记录 ${foods.value[item.name].label} · ${format(item.grams)} g`);return log.value.at(-1)}
function addFood(){try{recordFood(selected.value,grams.value)}catch(e){error.value=e.message}}
function removeFood(id){rollover();const i=log.value.findIndex(x=>x.id===id);if(i<0)return;const name=foods.value[log.value[i].name].label;log.value.splice(i,1);persist();notify(`已移除 ${name}`)}
function changeWeight(delta){grams.value=Math.max(1,Math.min(10000,(Number(grams.value)||0)+delta));error.value=''}
function onStorage(e){if(e.key===GRAPHICS_KEY||e.key===null)readGraphics();if(e.key===GOAL_SETTINGS_KEY||e.key===null)readGoals();if(e.key==='food-tracker'||e.key===FOOD_LIBRARY_KEY||e.key===null){date.value=dayKey();read()}}
onMounted(()=>{readGraphics();readGoals();read();unregisterTools=registerNutritionTools({read:()=>({date:date.value,goals:goalSettings.value.goals,totals:eaten.value,log:log.value,foods:foods.value}),add:recordFood,remove:removeFood,afterUpdate:nextTick});window.addEventListener('storage',onStorage);midnightTimer=setInterval(rollover,30000);window.addEventListener('focus',rollover)});
onBeforeUnmount(()=>{if(foodDialog.value?.open)document.body.style.overflow=foodDialogOverflow??'';if(immersive.value)document.body.style.overflow=previousOverflow??'';unregisterTools?.();window.removeEventListener('storage',onStorage);clearInterval(midnightTimer);clearTimeout(notifyTimer);window.removeEventListener('focus',rollover)});
</script>

<template>
  <div class="app-shell" :class="`graphics-${graphicsTier}`">
    <div class="world-background" aria-hidden="true"><OrbitScene ref="backgroundScene" :quality="graphicsPreference" @quality="graphicsTier=$event" background :progress="macros.map(m=>eaten[m.key]/m.goal)" :active="activeMacro" :injection="injection" :suspended="immersive" @motion="motionPaused=$event"/></div>
    <div class="world-shade" aria-hidden="true"></div>
    <div v-if="injection && !motionPaused && !immersive" :key="injection.id" class="injection-flare" aria-hidden="true"></div>
    <header class="topbar">
      <a class="brand" href="#main" aria-label="FUEL 每日营养"><span class="brand-symbol"><Zap :size="24" fill="currentColor"/></span><span>FUEL<span class="brand-period">.</span></span><span class="brand-divider"></span><span class="brand-caption">每日营养</span></a>
      <div class="header-right"><span class="local-indicator"><i></i> {{saveIssue?'尚未保存':'仅在本机保存'}}</span><span class="day-chip">{{dateLabel}}</span></div>
    </header>
    <main id="main">
      <div class="page-heading"><div><span class="eyebrow"><span></span> YOUR DAILY FUEL</span><h1>今天，吃够了吗<span>？</span></h1></div><div class="heading-actions"><button type="button" class="outline-button settings-button" @click="goalsDialog.open()"><SlidersHorizontal :size="16"/> 设置目标</button><a href="#food-entry" class="outline-button">记录一口 <Plus :size="17"/></a></div></div>
      <div class="workspace">
        <section class="overview" aria-label="今日营养概览">
          <div class="orbit-panel">
            <div class="panel-top"><span class="micro-title">01 / NUTRIENT REACTOR</span><span class="status-pill"><i></i>{{ finished===3?'三项目标已达成':log.length?'能量持续注入中':'等待第一口能量'}}</span></div>
            <div class="orbit-space">
              <div class="field-caption" aria-hidden="true"><span>PERSONAL ENERGY SYSTEM</span><strong>每一口，<br/>都成为能量。</strong></div>
              <div class="energy-center"><span class="energy-caption"><Flame :size="15"/> 今日摄入</span><div class="energy-number"><AnimatedNumber :value="energy" :decimals="0"/></div><span class="energy-unit">KCAL</span><div class="energy-baseline">目标约 {{targetEnergy.toLocaleString('en-US')}} kcal</div></div>
              <span class="reactor-label"><span>FUEL CORE / 02</span><span>营养反应堆 <ArrowUpRight :size="12"/></span></span><span class="orbit-coordinate coordinate-left">P / C / F</span><span class="orbit-coordinate coordinate-right">DAILY INTAKE</span>
            </div>
            <div class="orbit-bottom"><span><i></i> 轨道填充 = 目标完成度</span><div class="field-controls"><GraphicsQuality :model-value="graphicsPreference" :tier="graphicsTier" @update:model-value="changeGraphics"/><button @click="backgroundScene?.toggleMotion()" :aria-label="motionPaused?'播放背景动画':'暂停背景动画'"><Play v-if="motionPaused" :size="15"/><Pause v-else :size="15"/></button><button @click="openLab"><Expand :size="15"/> 探索核心</button></div></div>
          </div>
          <div class="macro-grid">
            <article v-for="(macro,i) in macros" :key="macro.key" class="macro-card" :class="{highlighted:activeMacro===i}" tabindex="0" @mouseenter="activeMacro=i" @mouseleave="activeMacro=-1" @focus="activeMacro=i" @blur="activeMacro=-1" :style="{'--macro':macro.color}">
              <div class="macro-heading"><span class="macro-icon">{{['P','C','F'][i]}}</span><span>{{macro.name}}</span><span class="macro-percent">{{Math.round(eaten[macro.key]/macro.goal*100)}}<small>%</small></span></div>
              <div class="macro-numbers"><strong><AnimatedNumber :value="eaten[macro.key]" :decimals="1"/></strong><span>/ {{macro.goal}} <small>g</small></span></div>
              <div class="segmented-progress" role="progressbar" :aria-label="macro.name" :aria-valuenow="Math.min(macro.goal,Math.round(eaten[macro.key]))" :aria-valuemax="macro.goal" :aria-valuetext="`${format(eaten[macro.key])} 克，目标 ${macro.goal} 克，${macroStatus(eaten[macro.key],macro.goal)}`"><i v-for="n in 32" :key="n" :class="{filled:n/32<=eaten[macro.key]/macro.goal}"></i></div>
              <div class="macro-bottom"><span :class="{'over-target':eaten[macro.key]>macro.goal+.05}">{{macroStatus(eaten[macro.key],macro.goal)}}</span><span class="macro-en">{{macro.en}}</span></div>
            </article>
          </div>
        </section>
        <aside id="food-entry" class="entry-panel">
          <div class="panel-top"><span class="micro-title">02 / 记录食物</span><span class="entry-count">{{Object.keys(foods).length}} 种食物</span></div>
          <h2>这一口，<br/>吃了什么<span>？</span></h2>
          <form @submit.prevent="addFood" novalidate>
            <div class="food-select-heading"><label for="food-select" class="field-label">吃了什么</label><button type="button" class="new-food-button" @click="openFoodDialog"><Plus :size="14"/> 添加食物</button></div>
            <div class="select-wrap"><component :is="foodIcons[selectedFood.type]" :size="21"/><select id="food-select" v-model="selected" @change="error=''" aria-label="选择食物"><option v-for="(food,key) in foods" :key="key" :value="key">{{food.label}}{{food.type==='custom'?' · 自定义':''}}</option></select><ChevronDown :size="17"/></div>
            <label for="grams" class="field-label grams-label">吃了多少 <span>按实际食用重量</span></label>
            <div class="weight-input"><button type="button" aria-label="减少 10 克" @click="changeWeight(-10)"><Minus :size="18"/></button><div><input id="grams" type="number" min="0.1" max="10000" step="any" inputmode="decimal" v-model="grams" @input="error=''" :aria-invalid="Boolean(error)" aria-describedby="weight-error"/><span>g</span></div><button type="button" aria-label="增加 10 克" @click="changeWeight(10)"><Plus :size="18"/></button></div>
            <div class="portion-presets"><button v-for="n in [30,50,100,200]" type="button" :class="{active:Number(grams)===n}" @click="grams=n;error=''">{{n}} g</button></div>
            <div class="portion-preview"><div class="preview-heading"><span>这一份营养</span><span>≈ {{Math.round(calories(preview))}} kcal</span></div><div class="preview-macros"><div v-for="macro in macros" :key="macro.key" :style="{'--macro':macro.color}"><span><i></i>{{macro.name==='碳水化合物'?'碳水':macro.name}}</span><strong>{{format(preview[macro.key])}}<small> g</small></strong></div></div></div>
            <p v-if="error" id="weight-error" class="form-error" role="alert">{{error}}</p>
            <button ref="recordButton" class="add-button" type="submit"><Plus :size="20"/><span>记入今日 · 注入能量</span><ArrowUpRight :size="22"/></button>
          </form>
          <p class="entry-note"><Check :size="13"/> 记录后自动保存，随时可以删除</p>
        </aside>
      </div>
      <section class="food-journal" aria-labelledby="journal-title"><div class="journal-header"><div><span class="micro-title">03 / FOOD JOURNAL</span><h2 id="journal-title">今天的每一口 <span>{{String(log.length).padStart(2,'0')}}</span></h2></div><span class="journal-date">{{log.length?`已记录 ${log.length} 份食物`:'从你喜欢的食物开始'}}</span></div>
        <div v-if="!log.length" class="empty-journal"><div class="food-art-wrap"><img src="/food-art.png" alt="盛着燕麦、腰果与牛奶的玻璃碗" class="food-art" width="180" height="150"/></div><div><h3>你的今日菜单，等待第一笔。</h3><p>选一种食物，记下份量。剩下的交给 FUEL。</p></div><a href="#food-entry" class="empty-arrow" aria-label="去记录食物"><ArrowUpRight :size="24"/></a></div>
        <div v-else class="journal-table-wrap"><table class="journal-table"><thead><tr><th>食物 / 份量</th><th>蛋白质</th><th>碳水</th><th>脂肪</th><th>能量</th><th><span class="sr-only">操作</span></th></tr></thead><TransitionGroup tag="tbody" name="food"><tr v-for="item in reversedLog" :key="item.id"><td><div class="food-name-cell"><span class="food-type-icon"><component :is="foodIcons[foods[item.name].type]" :size="22"/></span><div><strong>{{foods[item.name].label}}</strong><span>{{format(item.grams)}} g <span v-if="item.time" class="food-time">· {{item.time}}</span></span></div></div></td><td v-for="macro in macros" :key="macro.key" :style="{color:macro.color}">{{format(nutrients(item.name,item.grams,foods)[macro.key])}}<small> g</small></td><td>{{Math.round(calories(nutrients(item.name,item.grams,foods)))}}<small> kcal</small></td><td><button class="delete-button" @click="removeFood(item.id)" :aria-label="`删除 ${foods[item.name].label} ${format(item.grams)} 克`"><Trash2 :size="16"/></button></td></tr></TransitionGroup></table></div>
      </section>
      <p v-if="goalsIssue" class="save-warning" role="alert">{{goalsIssue}}</p>
      <p v-if="libraryIssue" class="save-warning" role="alert">{{libraryIssue}}</p>
      <p v-if="saveIssue" class="save-warning" role="alert">{{saveIssue}}</p>
    </main>
    <footer><span class="footer-brand">FUEL<span> YOUR EVERYDAY.</span></span><span>保留原始食物数据 · 支持本地自定义</span><span class="footer-status"><i></i> DAILY NUTRITION</span></footer>

    <GoalSettings ref="goalsDialog" :settings="goalSettings" @saved="applyGoals"/>

    <dialog ref="foodDialog" class="food-dialog" @close="closeFoodDialog" aria-labelledby="custom-food-title" aria-describedby="custom-food-description">
      <div class="food-dialog-top"><span class="micro-title">YOUR FOOD LIBRARY</span><button type="button" @click="foodDialog.close()" aria-label="关闭添加食物"><X :size="20"/></button></div>
      <h2 id="custom-food-title">把喜欢的食物，<br/>加入你的食物库<span>。</span></h2>
      <p id="custom-food-description">照着包装上的营养成分表，填写<strong>每 100 克</strong>的含量。没有的营养素填 0。</p>
      <form @submit.prevent="addCustomFood" novalidate>
        <label for="custom-food-name" class="field-label">食物名称</label>
        <input ref="foodNameInput" id="custom-food-name" class="custom-name-input" v-model="foodDraft.label" maxlength="60" placeholder="例如：全麦吐司、香煎三文鱼" autocomplete="off" required @input="customFoodError=''"/>
        <div class="custom-macro-fields">
          <label v-for="macro in macros" :key="macro.key" :style="{'--macro':macro.color}" :for="`custom-${macro.key}`"><span><i></i>{{macro.key==='carb'?'碳水':macro.name}}</span><div><input :id="`custom-${macro.key}`" type="number" inputmode="decimal" min="0" max="100" step="any" v-model="foodDraft[macro.key]" placeholder="0" required :aria-label="`每100克${macro.name}含量`" @input="customFoodError=''"/><span>g</span></div></label>
        </div>
        <p class="custom-food-hint">加入食物库后，再按实际食用重量记入今日。</p>
        <p v-if="customFoodError" class="form-error" role="alert">{{customFoodError}}</p>
        <button type="submit" class="add-button"><Plus :size="19"/><span>保存并选用</span><ArrowUpRight :size="21"/></button>
        <p class="entry-note"><Check :size="13"/> 仅保存在此浏览器，明天也能继续用</p>
      </form>
    </dialog>

    <dialog v-if="immersive" ref="labDialog" class="energy-lab" @close="closeLab" aria-labelledby="lab-title">
      <div class="lab-top"><div><span class="eyebrow">FUEL / IMMERSIVE EXPERIENCE</span><h2 id="lab-title">你的能量，正在发生。</h2></div><div class="lab-top-actions"><GraphicsQuality :model-value="graphicsPreference" :tier="graphicsTier" @update:model-value="changeGraphics"/><button class="lab-close" @click="labDialog.close()"><span>返回记录</span><X :size="20"/></button></div></div>
      <div class="lab-scene"><OrbitScene :quality="graphicsPreference" @quality="graphicsTier=$event" :immersive="true" :progress="macros.map(m=>eaten[m.key]/m.goal)" :active="activeMacro" :revision="revision" @select="activeMacro=$event"/></div>
      <div class="lab-readout"><span>今日摄入</span><strong>{{energy.toLocaleString('en-US')}}<small> kcal</small></strong><span>目标约 {{targetEnergy.toLocaleString('en-US')}} kcal</span></div>
      <div class="lab-decoration" aria-hidden="true">NUTRIENT<br/>REACTOR<span>V.01 / PERSONAL ENERGY SYSTEM</span></div>
      <div class="lab-macros"><button v-for="(m,i) in macros" :key="m.key" :style="{'--macro':m.color}" @click="activeMacro=activeMacro===i?-1:i" :aria-pressed="activeMacro===i"><span><i></i>{{m.name}}</span><strong>{{format(eaten[m.key])}}<small> / {{m.goal}} g</small></strong><span class="lab-meter"><i :style="{width:Math.min(100,eaten[m.key]/m.goal*100)+'%'}"></i></span><span>{{macroStatus(eaten[m.key],m.goal)}}</span></button></div>
    </dialog>
    <Transition name="toast"><div v-if="message" class="toast" role="status"><span><Check :size="17"/></span>{{message}}</div></Transition>
  </div>
</template>
