<script setup>
import {ref,watch,onBeforeUnmount} from 'vue';
const props=defineProps({value:{type:Number,default:0},decimals:{type:Number,default:0}});
const shown=ref(props.value);let frame;
watch(()=>props.value,(target)=>{
  cancelAnimationFrame(frame);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){shown.value=target;return}
  const start=shown.value,begin=performance.now();
  function tick(now){const p=Math.min(1,(now-begin)/800);shown.value=start+(target-start)*(1-Math.pow(1-p,4));if(p<1)frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick);
});
onBeforeUnmount(()=>cancelAnimationFrame(frame));
</script>
<template><span>{{Number(shown.toFixed(decimals)).toLocaleString('en-US',{maximumFractionDigits:decimals})}}</span></template>
