/**
 * 前端常量定义
 * 包含导航分组与插件候选名称
 */

import type { SharedNavSection } from "shared-nav";

export const NAV_SECTIONS: SharedNavSection[] = [
  { title: "好感度设置", key: "affinity" },
  { title: "黑名单设置", key: "blacklist" },
  { title: "关系设置", key: "relationship" },
  { title: "变量设置", key: "variables" },
  { title: "XML 工具设置", key: "xmlTools" },
  { title: "其他设置", key: "otherSettings" },
];

export const PLUGIN_NAME = "koishi-plugin-chatluna-affinity";
export const PLUGIN_CANDIDATE_NAMES = [PLUGIN_NAME, "chatluna-affinity"];
