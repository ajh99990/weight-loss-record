<script setup>
import {ref,computed,watch,onBeforeUnmount} from 'vue';
import {X,Check,ArrowUpRight,Calculator,SlidersHorizontal,RotateCcw} from 'lucide-vue-next';
import {GOALS,MACROS,calories} from './nutrition';
import {ACTIVITY_LEVELS,INTENTIONS,validateGoals,estimateTargets,saveGoalSettings} from './goals';
const props=defineProps({settings:{type:Object,required:true}});
const emit=defineEmits(['saved']);
const dialog=ref(null),mode=ref('manual'),manual=ref({...GOALS}),error=ref(''),result=ref(null);
const emptyProfile=()=>({sex:'',age:'',height:'',weight:'',activity:'sedentary',intention:'maintain',eligible:false});
const profile=ref(emptyProfile());
let opener,previousOverflow;
watch(profile,()=>{result.value=null;error.value='';},{deep:true,flush:'sync'});
watch(mode,()=>error.value='');
const manualEnergy=computed(()=>{try{return Math.round(calories(validateGoals(manual.value)))}catch{return null}});
function open(){
  opener=document.activeElement;previousOverflow=document.body.style.overflow;
  manual.value={...props.settings.goals};profile.value=props.settings.profile?{...props.settings.profile}:emptyProfile();
  mode.value=props.settings.source==='estimated'?'estimated':'manual';error.value='';result.value=null;
  if(mode.value==='estimated'){try{result.value=estimateTargets(profile.value)}catch{}}
  dialog.value.showModal();document.body.style.overflow='hidden';
}
function closed(){document.body.style.overflow=previousOverflow??'';opener?.focus();}
function calculate(){try{result.value=estimateTargets(profile.value);error.value='';}catch(e){result.value=null;error.value=e.message;}}
function adjust(){manual.value={...result.value.goals};mode.value='manual';}
function save(){
  try{
    if(mode.value==='estimated'&&!result.value)throw new Error('请先估算，再确认采用');
    const settings=saveGoalSettings(localStorage,{source:mode.value,goals:manual.value,profile:mode.value==='estimated'?profile.value:(result.value?.profile??props.settings.profile)});
    emit('saved',settings);dialog.value.close();
  }catch(e){error.value=e.message;}
}
function reset(){manual.value={...GOALS};error.value='';}
onBeforeUnmount(()=>{if(dialog.value?.open)document.body.style.overflow=previousOverflow??'';});
defineExpose({open});
</script>
<template>
  <dialog ref="dialog" class="food-dialog goals-dialog" @close="closed" aria-labelledby="goals-title">
    <div class="food-dialog-top"><span class="micro-title">YOUR DAILY TARGETS</span><button type="button" @click="dialog.close()" aria-label="关闭目标设置"><X :size="20"/></button></div>
    <h2 id="goals-title">每天吃多少，<br/>按你的情况来<span>。</span></h2>
    <div class="goal-mode-switch" role="group" aria-label="设置方式">
      <button type="button" :aria-pressed="mode==='manual'" @click="mode='manual'"><SlidersHorizontal :size="16"/> 手动设置</button>
      <button type="button" :aria-pressed="mode==='estimated'" @click="mode='estimated'"><Calculator :size="16"/> 按个人信息估算</button>
    </div>
    <form v-if="mode==='manual'" @submit.prevent="save" novalidate>
      <p class="goal-intro">填写每天的摄入目标，单位为克。保存后，三条轨道和剩余量会一起更新。</p>
      <div class="custom-macro-fields goal-macro-inputs">
        <label v-for="m in MACROS" :key="m.key" :for="`goal-${m.key}`" :style="{'--macro':m.color}"><span><i></i>{{m.key==='carb'?'碳水':m.name}}</span><div><input :id="`goal-${m.key}`" v-model="manual[m.key]" type="number" inputmode="decimal" min="0.1" max="1000" step="any" required :aria-label="`每日${m.name}目标`" @input="error=''"/><span>g</span></div></label>
      </div>
      <div class="goal-energy-total"><span>对应每日能量</span><strong>{{manualEnergy===null?'—':manualEnergy.toLocaleString('en-US')}} <small>kcal</small></strong></div>
      <p v-if="manualEnergy!==null && manualEnergy<1200" class="goal-caution">这个目标的总能量偏低，请核对数值；如用于减重，建议先与医生或营养师确认。</p>
      <button type="button" class="goal-reset" @click="reset"><RotateCcw :size="13"/> 填入原始目标（140 / 130 / 55 g）</button>
      <p v-if="error" class="form-error" role="alert">{{error}}</p>
      <button type="submit" class="add-button"><Check :size="19"/><span>保存目标</span><ArrowUpRight :size="21"/></button>
    </form>
    <form v-else @submit.prevent="calculate" novalidate>
      <p class="goal-intro">根据身体信息与活动量，给出一个可调整的起点。实际需求会因个体差异而变化。</p>
      <div class="profile-grid">
        <label for="profile-sex"><span>生理性别 <small>公式参数</small></span><select id="profile-sex" v-model="profile.sex" required><option disabled value="">请选择</option><option value="female">女性</option><option value="male">男性</option></select></label>
        <label for="profile-age"><span>年龄 <small>岁</small></span><input id="profile-age" type="number" inputmode="numeric" min="18" max="80" step="1" placeholder="18–80" v-model="profile.age" required/></label>
        <label for="profile-height"><span>身高 <small>cm</small></span><input id="profile-height" type="number" inputmode="decimal" min="120" max="230" step="any" placeholder="例如 170" v-model="profile.height" required/></label>
        <label for="profile-weight"><span>当前体重 <small>kg</small></span><input id="profile-weight" type="number" inputmode="decimal" min="30" max="300" step="any" placeholder="例如 65" v-model="profile.weight" required/></label>
        <label for="profile-activity" class="profile-wide"><span>日常活动量</span><select id="profile-activity" v-model="profile.activity"><option v-for="a in ACTIVITY_LEVELS" :key="a.key" :value="a.key">{{a.label}}</option></select></label>
        <label for="profile-intention" class="profile-wide"><span>体重目标</span><select id="profile-intention" v-model="profile.intention"><option v-for="i in INTENTIONS" :key="i.key" :value="i.key">{{i.label}}</option></select></label>
      </div>
      <label class="goal-eligibility"><input type="checkbox" v-model="profile.eligible"/><span>我已成年，非孕哺期，且没有需要医生或营养师制定特殊饮食方案的情况。</span></label>
      <button type="submit" class="goal-calculate"><Calculator :size="17"/> {{result?'重新估算':'估算每日目标'}}</button>
      <p v-if="error" class="form-error" role="alert">{{error}}</p>
      <section v-if="result" class="goal-estimate" aria-label="估算结果" aria-live="polite">
        <div class="estimate-top"><span>你的每日目标 · 估算值</span><strong>{{result.energy.toLocaleString('en-US')}} <small>kcal</small></strong></div>
        <div class="estimate-macros"><div v-for="m in MACROS" :key="m.key" :style="{'--macro':m.color}"><span>{{m.key==='carb'?'碳水':m.name}}</span><strong>{{result.goals[m.key]}}<small> g</small></strong></div></div>
        <div class="estimate-breakdown"><span>静息消耗约 {{result.restingEnergy}} kcal</span><span>包含活动后约 {{result.maintenanceEnergy}} kcal</span><span>{{result.adjustmentPercent===0?'维持：不增减能量':result.adjustmentPercent<0?'温和减脂：减少约 10%':'缓慢增重：增加约 10%'}}</span></div>
        <p>按能量分配：蛋白质 25% · 碳水 45% · 脂肪 30%。这是通用起点，不是唯一合适的比例。</p>
        <button type="button" class="add-button" @click="save"><Check :size="19"/><span>采用这组目标</span><ArrowUpRight :size="21"/></button>
        <button type="button" class="estimate-adjust" @click="adjust">转到手动设置，微调克数 <ArrowUpRight :size="14"/></button>
      </section>
      <details class="goal-method"><summary>怎么算的？</summary><p>先用 Mifflin–St Jeor 公式估算静息能量，再乘活动系数（1.2 / 1.375 / 1.55 / 1.725）。维持体重不调整，减脂减少 10%，增重增加 10%；后两项和营养素比例是本工具的起始设定，不代表保证的体重变化速度。</p><p>蛋白质、碳水按 4 kcal/g，脂肪按 9 kcal/g 换算，克数保留一位小数。活动量是粗略估计，不要再重复加上运动消耗。请结合一段时间的体重趋势、饥饿感和身体状态调整。</p><p>只用于一般成年人的日常规划，不替代个体化营养指导。体重偏低时不提供减脂估算；过低或异常高的结果不自动采用。</p><div class="goal-sources"><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener noreferrer">能量公式</a><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8862522/" target="_blank" rel="noopener noreferrer">活动系数</a><a href="https://www.ncbi.nlm.nih.gov/books/NBK545442/" target="_blank" rel="noopener noreferrer">营养素分配范围</a><a href="https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner" target="_blank" rel="noopener noreferrer">适用范围</a></div></details>
    </form>
    <p class="entry-note"><Check :size="13"/> 仅在保存或采用后生效，资料只保存在此浏览器</p>
  </dialog>
</template>
