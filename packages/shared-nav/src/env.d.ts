/**
 * Vue 模块类型声明
 * 允许 TypeScript 识别 .vue 文件
 */

declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
  export default component;
}
