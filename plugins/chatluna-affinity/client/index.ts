/**
 * 前端入口
 * 注册 Koishi 控制台插件详情扩展
 */

import { Context } from '@koishijs/client'
import AffinityDetailsLoader from './AffinityDetailsLoader.vue'
import AffinityDashboardPage from './AffinityDashboardPage.vue'
import './style.css'

export default (ctx: Context) => {
    ctx.page({
        id: 'chatluna-affinity-dashboard',
        path: '/chatluna-affinity/dashboard',
        name: '好感度仪表盘',
        desc: '查看当前 scopeId 的好感度统计',
        icon: 'star-empty',
        order: 560,
        authority: 1,
        component: AffinityDashboardPage,
    })

    ctx.slot({
        type: 'plugin-details',
        component: AffinityDetailsLoader,
        order: -999
    })
}
