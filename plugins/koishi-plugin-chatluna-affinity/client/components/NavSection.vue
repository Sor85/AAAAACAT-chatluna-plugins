<!--
  导航区域列表组件
  显示设置区域的导航项
-->
<template>
    <div
        v-for="nav in sections"
        :key="nav.key"
        :class="[$style.item, activeKey === nav.key ? $style.active : '']"
        @click="$emit('select', nav)"
    >
        {{ nav.title }}
    </div>
</template>

<script setup lang="ts">
import type { NavSection } from '../constants'

defineProps<{
    sections: NavSection[]
    activeKey: string
}>()

defineEmits<{
    (e: 'select', nav: NavSection): void
}>()
</script>

<style module lang="scss">
.item {
    padding: 8px 16px;
    font-size: 13px;
    color: var(--k-text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    border-radius: 9999px;
    margin: 4px 0;
    background: transparent;

    &:hover {
        background: rgba(0, 0, 0, 0.06);
        color: var(--k-text-active);
    }

    &.active {
        color: #fff;
        background: var(--k-color-primary);
        font-weight: 500;
    }
}
</style>
