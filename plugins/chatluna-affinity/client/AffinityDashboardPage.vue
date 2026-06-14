<!--
  好感度仪表盘页面
  作为 Koishi ctx.page 的 Vue 外壳挂载 React 仪表盘
-->
<template>
    <k-layout container="page-affinity-dashboard-shell" main="page-affinity-dashboard">
        <k-content>
            <div ref="dashboardRoot" />
        </k-content>
    </k-layout>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { mountAffinityDashboard } from './dashboard/mount'

const dashboardRoot = ref<HTMLElement | null>(null)
let disposeDashboard: (() => void) | null = null

onMounted(async () => {
    await nextTick()
    if (!dashboardRoot.value) return
    disposeDashboard = mountAffinityDashboard(dashboardRoot.value)
})

onBeforeUnmount(() => {
    disposeDashboard?.()
    disposeDashboard = null
})
</script>
