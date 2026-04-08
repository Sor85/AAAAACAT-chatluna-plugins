/**
 * 共享导航类型定义
 * 描述导航项与组件配置参数
 */

export interface SharedNavSection {
  key: string;
  title: string;
  matchText?: string;
}

export interface SharedNavProps {
  sections: SharedNavSection[];
  headerSelector?: string;
  boundarySelector?: string;
  initialTop?: number;
  initialRight?: number;
  rootMargin?: string;
  threshold?: number;
}
