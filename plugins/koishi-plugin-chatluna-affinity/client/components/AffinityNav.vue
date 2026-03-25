<!--
  好感度配置导航组件
  提供可拖拽的配置快捷导航面板
-->
<template>
    <div :class="[$style.container, isCollapsed ? $style.collapsed : '']" :style="position">
        <div
            :class="$style.header"
            @mousedown="onStartDrag"
            @touchstart="onStartDrag"
        >
            <IconMove :class="$style.move" />
            <div :class="$style.toggle" @click="toggleCollapse" @mousedown.stop @touchstart.stop>
                <IconChevronDown />
            </div>
        </div>
        <div :class="$style.body">
            <NavSection
                :sections="navSections"
                :active-key="activeSection"
                @select="toNavSection"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconMove from '../icons/IconMove.vue'
import IconChevronDown from '../icons/IconChevronDown.vue'
import NavSection from './NavSection.vue'
import { useDraggable, useScrollSpy } from '../composables'
import {
    NAV_SECTIONS,
    KEY_TO_TITLE,
    TITLE_TO_KEY,
    type NavSection as NavSectionType
} from '../constants'

const isCollapsed = ref(false)

const toggleCollapse = (e: MouseEvent) => {
    e.stopPropagation()
    isCollapsed.value = !isCollapsed.value
}

const { position, startDrag } = useDraggable(100, 20)

const onStartDrag = (event: MouseEvent | TouchEvent) => {
    startDrag(event, 'container')
}

const navSections = NAV_SECTIONS

const { activeSection } = useScrollSpy(TITLE_TO_KEY)

const toNavSection = (nav: NavSectionType) => {
    activeSection.value = nav.key

    const nodes = document.querySelectorAll('.k-schema-header')
    for (let i = 0; i < nodes.length; i++) {
        const item = nodes[i] as HTMLElement
        const text = item.textContent || ''
        if (text.includes(KEY_TO_TITLE[nav.key])) {
            item.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }
    }
}
</script>

<style module lang="scss">
.container {
    position: absolute;
    z-index: 1000;
    width: 140px;
    max-width: 90vw;
    max-height: 70vh;
    background: transparent;
    display: flex;
    flex-direction: column;
    font-family:
        'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
        'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
    user-select: none;
    overflow: visible;

    @media (max-width: 768px) {
        width: 120px;
        max-height: 50vh;
    }

    .header {
        padding: 6px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        background: rgba(255, 255, 255, 0.85);
        border-radius: 20px;
        backdrop-filter: blur(8px);
        margin-bottom: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

        &:hover {
            background: rgba(255, 255, 255, 0.95);
        }

        .move {
            color: var(--k-text-light);
            cursor: grab;
            transition: color 0.2s;
            &:active {
                cursor: grabbing;
                color: var(--k-color-primary);
            }
        }

        .toggle {
            cursor: pointer;
            color: var(--k-text-light);
            transition: transform 0.3s ease, color 0.2s;
            display: flex;
            align-items: center;
            padding: 2px;

            &:hover {
                color: var(--k-color-primary);
            }
        }
    }

    .body {
        overflow-y: auto;
        padding: 4px 0;
        transition: max-height 0.3s ease, opacity 0.3s ease;
        opacity: 1;
        scrollbar-width: none;
        -ms-overflow-style: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }

    &.collapsed {
        max-height: 40px !important;

        .body {
            max-height: 0;
            padding: 0;
            opacity: 0;
            overflow: hidden;
        }

        .toggle {
            transform: rotate(180deg);
        }
    }
}
</style>
