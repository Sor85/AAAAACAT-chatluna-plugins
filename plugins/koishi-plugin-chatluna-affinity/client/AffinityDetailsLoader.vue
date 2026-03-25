<!--
  好感度详情加载器
  根据当前插件名称决定是否显示导航组件
-->
<template>
    <AffinityNav v-if="isOwn" />
</template>

<script setup lang="ts">
import { ComputedRef, inject, computed } from 'vue'
import AffinityNav from './components/AffinityNav.vue'
import { PLUGIN_NAME } from './constants'

const pluginName = inject<ComputedRef<string>>('plugin:name')
const isOwn = computed(() => pluginName?.value === PLUGIN_NAME)
</script>
