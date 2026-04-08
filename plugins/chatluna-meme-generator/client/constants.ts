/**
 * 前端常量定义
 * 包含导航分组和插件候选名称
 */

import type { SharedNavSection } from "shared-nav";

export const NAV_SECTIONS: SharedNavSection[] = [
  { title: "基础设置", key: "basic" },
  { title: "文本补全设置", key: "text" },
  { title: "图片补全设置", key: "image" },
  { title: "随机触发设置", key: "random" },
  { title: "触发方式设置", key: "trigger" },
  { title: "模板筛选设置", key: "filter" },
  { title: "其他设置", key: "runtime" },
];

export const PLUGIN_CANDIDATE_NAMES = [
  "koishi-plugin-chatluna-meme-generator",
  "chatluna-meme-generator",
];
