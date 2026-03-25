<!--
  变量列表组件
  显示可用变量及其启用状态
-->
<template>
    <div :class="$style.divider">可用变量</div>
    <div
        v-for="variable in variables"
        :key="'var-' + variable.key"
        :class="[$style.item, $style.toolItem, activeKey === 'var-' + variable.key ? $style.active : '']"
        @click="$emit('select', variable)"
    >
        <span :class="$style.toolIndicator">
            <span v-if="variable.enabled" :class="$style.indicatorOn"></span>
            <span v-else :class="$style.indicatorOff"></span>
        </span>
        <span :class="$style.toolName">{{ variable.name }}</span>
    </div>
</template>

<script setup lang="ts">
import type { VariableItem } from '../constants'

defineProps<{
    variables: VariableItem[]
    activeKey: string
}>()

defineEmits<{
    (e: 'select', variable: VariableItem): void
}>()
</script>

<style module lang="scss">
.divider {
    padding: 8px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--k-text-light);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 8px;
}

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

.toolItem {
    display: flex;
    align-items: center;
    gap: 8px;
}

.toolIndicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 10px;
    height: 10px;
    flex-shrink: 0;
}

.indicatorOn {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #52c41a;
    box-shadow: 0 0 4px rgba(82, 196, 26, 0.6);
}

.indicatorOff {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #ff4d4f;
    box-shadow: 0 0 4px rgba(255, 77, 79, 0.6);
}

.toolName {
    flex: 1;
}
</style>
