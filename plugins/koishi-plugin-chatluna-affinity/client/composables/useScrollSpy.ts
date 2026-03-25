/**
 * 滚动监视组合式函数
 * 监听页面滚动并高亮当前可见区域
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'

export interface ScrollSpyOptions {
    rootMargin?: string
    threshold?: number
}

export function useScrollSpy(
    titleMap: Record<string, string>,
    options: ScrollSpyOptions = {}
) {
    const activeSection = ref('')
    let observer: IntersectionObserver | null = null
    const sectionElements = new Map<Element, string>()

    const initScrollSpy = () => {
        if (observer) {
            observer.disconnect()
            sectionElements.clear()
        }

        observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const sectionKey = sectionElements.get(entry.target)
                        if (sectionKey) {
                            activeSection.value = sectionKey
                        }
                    }
                }
            },
            {
                root: null,
                rootMargin: options.rootMargin || '-20% 0px -60% 0px',
                threshold: options.threshold || 0
            }
        )

        const headers = document.querySelectorAll('.k-schema-header')
        headers.forEach((header) => {
            const text = header.textContent || ''
            for (const [title, key] of Object.entries(titleMap)) {
                if (text.includes(title)) {
                    observer?.observe(header)
                    sectionElements.set(header, key)
                    break
                }
            }
        })
    }

    const refresh = () => {
        setTimeout(initScrollSpy, 500)
    }

    onMounted(() => {
        refresh()
    })

    onUnmounted(() => {
        observer?.disconnect()
    })

    return {
        activeSection,
        refresh
    }
}
