<script setup>
import {ref,watch,onMounted,onBeforeUnmount} from 'vue';
import {Pause,Play,RotateCcw,Expand,Plus,Minus,Sparkles,Layers} from 'lucide-vue-next';
const props=defineProps({progress:{type:Array,default:()=>[0,0,0]},active:{type:Number,default:-1},revision:{type:Number,default:0},immersive:{type:Boolean,default:false},suspended:{type:Boolean,default:false},background:{type:Boolean,default:false},injection:{type:Object,default:null},quality:{type:String,default:'auto'}});
const emit=defineEmits(['select','expand','motion','quality']);
const host=ref(null),ready=ref(false),failed=ref(false),paused=ref(false),exploded=ref(false),modelError=ref(false);
let scene,disposed=false,media;
function setMotion(){scene?.setPaused(paused.value);emit('motion',paused.value)}
defineExpose({toggleMotion(){paused.value=!paused.value}});
function onPreference(e){paused.value=e.matches;setMotion()}
function fallback(){ready.value=false;failed.value=true}
onMounted(async()=>{
  media=matchMedia('(prefers-reduced-motion: reduce)');paused.value=media.matches;media.addEventListener('change',onPreference);emit('motion',paused.value);
  try {const {createOrbit}=await import('./orbit');if(disposed)return;scene=createOrbit(host.value,{reduced:paused.value,immersive:props.immersive,background:props.background,quality:props.quality,onQuality:tier=>emit('quality',tier),onModelFailure:()=>modelError.value=true,onSelect:index=>emit('select',index),onFailure:fallback});scene.setProgress(props.progress);scene.setActive(props.active);scene.setSuspended(props.suspended);if(props.injection)scene.pulse(props.injection.origin);ready.value=true;}catch{fallback()}
});
watch(()=>props.quality,value=>scene?.setQuality(value));
watch(()=>props.progress,v=>scene?.setProgress(v),{deep:true});
watch(()=>props.active,v=>scene?.setActive(v));
watch(()=>props.revision,()=>scene?.pulse());
watch(()=>props.injection,value=>{if(value)scene?.pulse(value.origin)});
watch(paused,setMotion);
watch(()=>props.suspended,v=>scene?.setSuspended(v));
watch(exploded,v=>scene?.setExploded(v));
onBeforeUnmount(()=>{disposed=true;scene?.dispose();media?.removeEventListener('change',onPreference)});
</script>
<template>
  <div class="three-stage" ref="host" :class="{'is-ready':ready,'is-immersive':immersive}" aria-hidden="true"></div>
  <svg v-if="!ready" class="orbit-fallback" viewBox="0 0 500 500" aria-hidden="true"><g fill="none" transform="translate(250,250) rotate(-90)"><g v-for="(color,i) in ['#cefc68','#88bdff','#ff9b76']" :key="i"><circle :r="194-i*34" :stroke="color" stroke-opacity=".25" :stroke-width="18-i*2"/><circle :r="194-i*34" :stroke="color" :stroke-width="18-i*2" pathLength="100" :stroke-dasharray="`${Math.min(1,progress[i])*100} 100`" stroke-linecap="round" :opacity="progress[i]>0?1:0"/></g></g></svg>
  <div v-if="ready && !background" class="orbit-controls" :class="{expanded:immersive}"><span class="orbit-drag-hint">{{immersive?'拖动旋转 · 滚轮缩放':'移动鼠标，探索装置'}}</span><button @click="paused=!paused" :aria-label="paused?'播放轨道动效':'暂停轨道动效'" :title="paused?'播放动效':'暂停动效'"><Play v-if="paused" :size="13"/><Pause v-else :size="13"/></button><button @click="scene?.reset();emit('select',-1)" aria-label="复位轨道" title="复位轨道"><RotateCcw :size="13"/></button><button v-if="!immersive" class="expand-orbit" @click="emit('expand')" aria-label="进入沉浸式 3D 视图"><Expand :size="14"/><span>进入能量场</span></button><template v-if="immersive"><button @click="scene?.zoom(.88)" aria-label="放大模型" title="放大"><Plus :size="16"/></button><button @click="scene?.zoom(1.12)" aria-label="缩小模型" title="缩小"><Minus :size="16"/></button><button class="lab-action" @click="exploded=!exploded" :aria-pressed="exploded"><Layers :size="15"/><span>{{exploded?'重组核心':'展开核心'}}</span></button><button class="lab-action pulse-action" @click="scene?.pulse()" :disabled="paused"><Sparkles :size="15"/><span>能量脉冲</span></button></template></div>
  <span v-if="failed" class="orbit-fallback-note">简洁视图</span>
<span v-if="modelError" class="orbit-fallback-note">核心载入失败，轨道仍可使用</span>
</template>
