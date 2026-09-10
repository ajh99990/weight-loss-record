<script setup>
import {QUALITY_LEVELS} from './graphics-quality';
defineProps({modelValue:{type:String,default:'auto'},tier:{type:String,default:'balanced'}});
const emit=defineEmits(['update:modelValue']);
</script>
<template>
  <label class="graphics-quality"><span>画质</span><select aria-label="动画画质" :value="modelValue" @change="emit('update:modelValue',$event.target.value)"><option value="auto">自动 · {{QUALITY_LEVELS[tier]?.label||'均衡'}}</option><option value="low">流畅</option><option value="balanced">均衡</option><option value="ultra">最高</option></select></label>
</template>
