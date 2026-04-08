/**
 * 前端常量定义
 * 包含导航分组和插件候选名称
 */

import type { SharedNavSection } from "shared-nav";

export const NAV_SECTIONS: SharedNavSection[] = [
  { title: "基础设置", key: "basic" },
  { title: "原生工具", key: "nativeTools" },
  { title: "XML 工具", key: "xmlTools" },
  { title: "其他变量", key: "variables" },
  { title: "其他设置", key: "other" },
];

export const PLUGIN_CANDIDATE_NAMES = [
  "chatluna-toolbox",
  "koishi-plugin-chatluna-toolbox",
];
