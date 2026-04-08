/**
 * 前端入口
 * 注册 Koishi 控制台插件详情扩展
 */

import { Context } from "@koishijs/client";
import ScheduleDetailsLoader from "./ScheduleDetailsLoader.vue";

export default (ctx: Context) => {
  ctx.slot({
    type: "plugin-details",
    component: ScheduleDetailsLoader,
    order: -999,
  });
};
