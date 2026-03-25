/**
 * 可拖拽组合式函数
 * 提供元素拖拽位置控制功能
 */

import { reactive, computed, onUnmounted } from 'vue'

export interface DraggableState {
    top: number
    right: number
    isDragging: boolean
}

export function useDraggable(initialTop = 100, initialRight = 20) {
    const state = reactive({
        isDragging: false,
        top: initialTop,
        right: initialRight,
        startTop: 0,
        startRight: 0,
        startX: 0,
        startY: 0,
        width: 0,
        height: 0
    })

    const position = computed(() => ({
        top: state.top + 'px',
        right: state.right + 'px'
    }))

    const onMouseMove = (event: MouseEvent | TouchEvent) => {
        if (!state.isDragging) return

        const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX
        const clientY = event instanceof TouchEvent ? event.touches[0].clientY : event.clientY

        let newTop = state.startTop + (clientY - state.startY)
        let newRight = state.startRight - (clientX - state.startX)

        const boundary = document.querySelector('.plugin-view')?.getBoundingClientRect()

        let minTop = 0
        let maxTop = window.innerHeight - state.height
        let minRight = 0
        let maxRight = window.innerWidth - state.width

        if (boundary) {
            minTop = boundary.top
            maxTop = boundary.bottom - state.height
            minRight = window.innerWidth - boundary.right
            maxRight = window.innerWidth - boundary.left - state.width
        }

        state.top = Math.max(minTop, Math.min(maxTop, newTop))
        state.right = Math.max(minRight, Math.min(maxRight, newRight))
    }

    const startDrag = (event: MouseEvent | TouchEvent, containerClass: string) => {
        const clientX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX
        const clientY = event instanceof TouchEvent ? event.touches[0].clientY : event.clientY

        const target = event.target as HTMLElement
        const container = target.closest(`.${containerClass}`)
        const rect = container?.getBoundingClientRect()

        if (rect) {
            state.width = rect.width
            state.height = rect.height
        }

        state.startTop = state.top
        state.startRight = state.right
        state.startX = clientX
        state.startY = clientY
        state.isDragging = true
    }

    const endDrag = () => {
        state.isDragging = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('touchmove', onMouseMove)
    window.addEventListener('touchend', endDrag)

    onUnmounted(() => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', endDrag)
        window.removeEventListener('touchmove', onMouseMove)
        window.removeEventListener('touchend', endDrag)
    })

    return {
        state,
        position,
        startDrag,
        endDrag
    }
}
