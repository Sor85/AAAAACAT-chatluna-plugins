/**
 * 滚动监视组合式函数
 * 监听页面滚动并高亮当前可见区域
 */

import { onMounted, onUnmounted, ref } from "vue";

interface UseScrollSpyOptions {
  titleToKeyMap: Record<string, string>;
  headerSelector?: string;
  rootMargin?: string;
  threshold?: number;
}

export function useScrollSpy(options: UseScrollSpyOptions) {
  const {
    titleToKeyMap,
    headerSelector = ".k-schema-header",
    rootMargin = "-20% 0px -60% 0px",
    threshold = 0,
  } = options;

  const activeSection = ref("");
  let observer: IntersectionObserver | null = null;
  const sectionElements = new Map<Element, string>();

  const initScrollSpy = () => {
    observer?.disconnect();
    sectionElements.clear();

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const sectionKey = sectionElements.get(entry.target);
          if (!sectionKey) {
            continue;
          }

          activeSection.value = sectionKey;
        }
      },
      {
        root: null,
        rootMargin,
        threshold,
      },
    );

    const headers = document.querySelectorAll(headerSelector);
    headers.forEach((header) => {
      const text = header.textContent || "";
      for (const [title, key] of Object.entries(titleToKeyMap)) {
        if (!text.includes(title)) {
          continue;
        }
        observer?.observe(header);
        sectionElements.set(header, key);
        break;
      }
    });
  };

  const refresh = () => {
    setTimeout(initScrollSpy, 500);
  };

  onMounted(refresh);

  onUnmounted(() => {
    observer?.disconnect();
  });

  return {
    activeSection,
    refresh,
  };
}
