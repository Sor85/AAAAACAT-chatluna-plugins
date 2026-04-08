/**
 * 前端常量定义
 * 包含导航分组和插件候选名称
 */

import type { SharedNavSection } from "shared-nav";

export const NAV_SECTIONS: SharedNavSection[] = [
  { title: "基础设置", key: "basic" },
  { title: "Google Search", key: "googleSearch" },
  { title: "URL Context", key: "urlContext" },
  { title: "其他设置", key: "other" },
];

export const PLUGIN_CANDIDATE_NAMES = [
  "chatluna-gemini-tools",
  "koishi-plugin-chatluna-gemini-tools",
];
