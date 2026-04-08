<!--
  共享导航组件
  提供拖拽、折叠、滚动高亮与点击定位能力
-->
<template>
  <div ref="containerRef" :class="[$style.container, isCollapsed ? $style.collapsed : '']" :style="position">
    <div :class="$style.header" @mousedown="onStartDrag" @touchstart="onStartDrag">
      <IconMove :class="$style.move" />
      <div :class="$style.toggle" @click="toggleCollapse" @mousedown.stop @touchstart.stop>
        <IconChevronDown />
      </div>
    </div>
    <div :class="$style.body">
      <NavSection :sections="sections" :active-key="activeSection" @select="toNavSection" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { SharedNavProps, SharedNavSection } from "../types";
import IconMove from "../icons/IconMove.vue";
import IconChevronDown from "../icons/IconChevronDown.vue";
import NavSection from "./NavSection.vue";
import { useDraggable } from "../composables/useDraggable";
import { useScrollSpy } from "../composables/useScrollSpy";

const props = withDefaults(defineProps<SharedNavProps>(), {
  headerSelector: ".k-schema-header",
  boundarySelector: ".plugin-view",
  initialTop: 100,
  initialRight: 20,
  rootMargin: "-20% 0px -60% 0px",
  threshold: 0,
});

const isCollapsed = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const titleToKeyMap = computed<Record<string, string>>(() =>
  props.sections.reduce(
    (acc, item) => {
      acc[item.matchText ?? item.title] = item.key;
      return acc;
    },
    {} as Record<string, string>,
  ),
);

const keyToMatchTextMap = computed<Record<string, string>>(() =>
  props.sections.reduce(
    (acc, item) => {
      acc[item.key] = item.matchText ?? item.title;
      return acc;
    },
    {} as Record<string, string>,
  ),
);

const toggleCollapse = (event: MouseEvent) => {
  event.stopPropagation();
  isCollapsed.value = !isCollapsed.value;
};

const { position, startDrag } = useDraggable({
  initialTop: props.initialTop,
  initialRight: props.initialRight,
  boundarySelector: props.boundarySelector,
});

const onStartDrag = (event: MouseEvent | TouchEvent) => {
  startDrag(event, containerRef.value);
};

const { activeSection } = useScrollSpy({
  titleToKeyMap: titleToKeyMap.value,
  headerSelector: props.headerSelector,
  rootMargin: props.rootMargin,
  threshold: props.threshold,
});

const toNavSection = (nav: SharedNavSection) => {
  activeSection.value = nav.key;

  const nodes = document.querySelectorAll(props.headerSelector);
  for (let i = 0; i < nodes.length; i += 1) {
    const item = nodes[i] as HTMLElement;
    const text = item.textContent || "";
    if (text.includes(keyToMatchTextMap.value[nav.key])) {
      item.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
};
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
    "Helvetica Neue",
    Helvetica,
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    "微软雅黑",
    Arial,
    sans-serif;
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
