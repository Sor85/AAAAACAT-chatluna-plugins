/**
 * 前端入口
 * 注册 Koishi 控制台插件详情扩展
 */

import { Context } from '@koishijs/client'
import AffinityDetailsLoader from './AffinityDetailsLoader.vue'

export default (ctx: Context) => {
    ctx.slot({
        type: 'plugin-details',
        component: AffinityDetailsLoader,
        order: -999
    })
}
