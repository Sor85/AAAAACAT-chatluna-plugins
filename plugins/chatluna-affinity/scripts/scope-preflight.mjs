import postcss from 'postcss'

import { AFFINITY_STYLE_ROOTS } from './affinity-style-roots.mjs'

/* Tailwind preflight（@layer base）整块都是无作用域的类型选择器。Koishi 控制台把所有
   插件的样式表加载进同一个文档，所以这些规则会重置整个控制台和同页其他插件的 UI——
   最刺眼的是 `h1..h6 { font-weight: inherit }`：Koishi 配置页标题的粗体只来自浏览器
   UA 默认样式，作者层叠层（哪怕在 @layer base 里）优先级高于 UA origin，于是全控制台
   的配置页标题被抹平粗体。

   Tailwind v4 没有"给 preflight 加作用域"的配置项。社区做法是展开 @import 后省掉
   preflight、再手抄一份带作用域的副本——这里不采用，手抄副本会随 Tailwind 升级静默
   漂移。改成在 CLI 产物上做一次机械改写，preflight 因此始终与已安装的版本同步。

   作用域用 :where() 包裹是必需的，不是风格选择：preflight 必须停留在特异性最低层，
   否则会压过组件自身的样式。:where() 不贡献特异性，所以 `:where(根) small` 与原来的
   `small` 都是 0-0-1。 */

const PSEUDO_ELEMENT_PREFIX = '::'

/** 拆分逗号分隔的选择器列表，跳过括号、方括号与字符串里的逗号。 */
function splitSelectorList(selector) {
  const parts = []
  let depth = 0
  let quote = ''
  let current = ''
  for (const char of selector) {
    if (quote) {
      current += char
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === '\'') {
      quote = char
      current += char
      continue
    }
    if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth--
    else if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function scopeSelectorPart(part, scope) {
  // :root 映射到作用域根自身，而不是当作后代。@layer base 里除了 Tailwind preflight，
  // 还有 @heroui/styles/themes/default 的主题变量块（`:root, .light, .default,
  // [data-theme=...]`）。若按后代改写成 `:where(根) :root`，选择器永远匹配不到任何元素，
  // --default 等 HeroUI 令牌会静默变空，页签胶囊因此失去底色。
  if (part === ':root') return [scope]
  // HeroUI 的深色变量块（`.dark, [data-theme="dark"]`）同理不能当作后代：Koishi 把深色
  // 标记挂在 html 上，所以映射成「html.dark 下的作用域根」。:where() 保持特异性为 0，
  // 与上面的浅色块持平，靠源码顺序（深色块在后）覆盖。
  if (part === '.dark' || part === '[data-theme="dark"]') return [`:where(html.dark) ${scope}`]
  // html / :host 整条丢弃。它把 font-family 设成 Tailwind 的 --font-sans；改写前这条
  // 落在 html 上，被 Koishi 的 body { font-family: var(--font-family) } 以无 layer
  // 规则压住，所以仪表盘用的一直是控制台主题字体。一旦改写到渲染根上，两条规则匹配的
  // 就是不同元素，特异性比较不再发生，仪表盘会从 PingFang SC 跳到 -apple-system。
  // 真正需要保留的 line-height / tab-size / tap-highlight 在 client/style.css 显式声明。
  if (part === 'html' || part === ':host') return []
  // ::backdrop 只作用于 top layer 元素；本插件的浮层都是普通元素，无法也无需限定作用域。
  if (part === '::backdrop') return []
  // `*` 既要覆盖后代，也要覆盖渲染根自身（根也需要 box-sizing 与 border-style 重置）。
  if (part === '*') return [scope, `${scope} *`]
  if (part.startsWith(PSEUDO_ELEMENT_PREFIX)) return [`${scope}${part}`, `${scope} *${part}`]
  return [`${scope} ${part}`]
}

export function scopePreflight(css, roots = AFFINITY_STYLE_ROOTS) {
  const scope = `:where(${roots.join(', ')})`
  const ast = postcss.parse(css)
  let scopedRules = 0
  let droppedRules = 0

  ast.walkAtRules('layer', (layer) => {
    if (layer.params !== 'base' || !layer.nodes) return
    layer.walkRules((rule) => {
      // 原生嵌套里的子规则由父选择器带上作用域，不能重复前缀。
      if (rule.parent.type === 'rule') return
      const scoped = [
        ...new Set(splitSelectorList(rule.selector).flatMap((part) => scopeSelectorPart(part, scope))),
      ]
      if (!scoped.length) {
        rule.remove()
        droppedRules++
        return
      }
      rule.selectors = scoped
      scopedRules++
    })
  })

  if (!scopedRules) {
    throw new Error('未在 Tailwind 产物中找到 @layer base 规则；preflight 作用域改写没有生效，请检查 tailwind.source.css 的导入方式。')
  }
  return { css: ast.toString(), scopedRules, droppedRules }
}
