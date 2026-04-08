/**
 * 前端入口
 * 注册 Koishi 控制台插件详情扩展
 */

import { Context } from "@koishijs/client";
import ToolboxDetailsLoader from "./ToolboxDetailsLoader.vue";

export default (ctx: Context) => {
  ctx.slot({
    type: "plugin-details",
    component: ToolboxDetailsLoader,
    order: -999,
  });
};
