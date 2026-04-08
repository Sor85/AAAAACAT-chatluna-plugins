<!--
  好感度详情加载器
  根据当前插件名称决定是否显示共享导航组件
-->
<template>
    <SharedNav v-if="isOwn" :sections="navSections" />
</template>

<script setup lang="ts">
import { ComputedRef, computed, inject } from 'vue'
import { SharedNav } from 'shared-nav'
import { NAV_SECTIONS, PLUGIN_CANDIDATE_NAMES } from './constants'

const pluginName = inject<ComputedRef<string>>('plugin:name')
const navSections = NAV_SECTIONS
const isOwn = computed(() => {
    const name = pluginName?.value || ''
    return PLUGIN_CANDIDATE_NAMES.includes(name)
})
</script>
