/**
 * 可拖拽组合式函数
 * 提供元素拖拽位置控制功能
 */

import { computed, onUnmounted, reactive } from "vue";

interface DraggableState {
  isDragging: boolean;
  top: number;
  right: number;
  startTop: number;
  startRight: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
}

interface UseDraggableOptions {
  initialTop?: number;
  initialRight?: number;
  boundarySelector?: string;
}

function getClientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if (event instanceof TouchEvent) {
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }

  return {
    x: event.clientX,
    y: event.clientY,
  };
}

export function useDraggable(options: UseDraggableOptions = {}) {
  const {
    initialTop = 100,
    initialRight = 20,
    boundarySelector = ".plugin-view",
  } = options;

  const state = reactive<DraggableState>({
    isDragging: false,
    top: initialTop,
    right: initialRight,
    startTop: 0,
    startRight: 0,
    startX: 0,
    startY: 0,
    width: 0,
    height: 0,
  });

  const position = computed(() => ({
    top: `${state.top}px`,
    right: `${state.right}px`,
  }));

  const onMouseMove = (event: MouseEvent | TouchEvent) => {
    if (!state.isDragging) {
      return;
    }

    const point = getClientPoint(event);
    const newTop = state.startTop + (point.y - state.startY);
    const newRight = state.startRight - (point.x - state.startX);

    const boundary = document
      .querySelector(boundarySelector)
      ?.getBoundingClientRect();

    let minTop = 0;
    let maxTop = window.innerHeight - state.height;
    let minRight = 0;
    let maxRight = window.innerWidth - state.width;

    if (boundary) {
      minTop = boundary.top;
      maxTop = boundary.bottom - state.height;
      minRight = window.innerWidth - boundary.right;
      maxRight = window.innerWidth - boundary.left - state.width;
    }

    state.top = Math.max(minTop, Math.min(maxTop, newTop));
    state.right = Math.max(minRight, Math.min(maxRight, newRight));
  };

  const startDrag = (event: MouseEvent | TouchEvent, containerElement: HTMLElement | null) => {
    const point = getClientPoint(event);
    const rect = containerElement?.getBoundingClientRect();

    if (rect) {
      state.width = rect.width;
      state.height = rect.height;
    }

    state.startTop = state.top;
    state.startRight = state.right;
    state.startX = point.x;
    state.startY = point.y;
    state.isDragging = true;
  };

  const endDrag = () => {
    state.isDragging = false;
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", endDrag);
  window.addEventListener("touchmove", onMouseMove);
  window.addEventListener("touchend", endDrag);

  onUnmounted(() => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", endDrag);
    window.removeEventListener("touchmove", onMouseMove);
    window.removeEventListener("touchend", endDrag);
  });

  return {
    position,
    startDrag,
  };
}
