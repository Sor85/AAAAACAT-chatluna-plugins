/**
 * 前端常量定义
 * 包含导航分组和插件候选名称
 */

import type { SharedNavSection } from "shared-nav";

export const NAV_SECTIONS: SharedNavSection[] = [
  { title: "日程设置", key: "schedule" },
  { title: "天气设置", key: "weather" },
  { title: "变量设置", key: "variables" },
  { title: "工具调用", key: "tools" },
  { title: "其他设置", key: "other" },
];

export const PLUGIN_CANDIDATE_NAMES = [
  "chatluna-schedule",
  "koishi-plugin-chatluna-schedule",
];
