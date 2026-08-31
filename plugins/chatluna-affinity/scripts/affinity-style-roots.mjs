// 本插件所有使用 Tailwind 工具类的渲染根标记。
//
// Koishi 控制台把所有插件的样式表加载进同一个文档，Tailwind preflight 整块都是
// 无作用域的类型选择器（`*`、`h1`~`h6`、`a`、`ol, ul, menu`、`img, svg, video…`、
// `button, input, select, textarea`、`small`、`table`），会重置整个控制台和同页
// 其他插件的 UI。scripts/scope-preflight.mjs 用这份清单把 preflight 限制在本插件
// 子树内。
//
// 本插件只有两处渲染根，所以用一个统一的标记类而不是逐个列出结构选择器：
//   1. client/dashboard/AffinityDashboard.tsx 的 <section>（页面容器）
//   2. 同文件的 <Tooltip.Content>——HeroUI 走 react-aria Overlay，portal 到 body，
//      不在页面容器的继承树里
//   3. client/components/ui/sonner.tsx 的 Toaster（当前不 portal，防御性保留）
//
// 失效形态是静默的：漏标的子树整体拿不到 preflight，表现和"工具类半残"一样。
// 新增任何 portal / teleport 浮层时必须一起加上这个类，
// tests/client/tailwind-scope.test.ts 会断言上面三处都带着它。
export const AFFINITY_SCOPE_CLASS = 'affinity-tw-scope'

export const AFFINITY_STYLE_ROOTS = [`.${AFFINITY_SCOPE_CLASS}`]
