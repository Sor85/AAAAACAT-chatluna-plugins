/**
 * 插件入口导出
 * 导出元信息、配置与主 apply 函数
 */

export { name, inject, ConfigSchema as Config } from "./schema";
export { apply } from "./plugin";

export * from "./types";
export * from "./schema";
export * from "./runtime/think-runtime";
export * from "./store/think-store";
export * from "./xml/parse-think-content";
export * from "./commands/think";
