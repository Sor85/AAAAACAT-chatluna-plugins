import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scopePreflight } from './scope-preflight.mjs'

/* Tailwind 预编译的唯一入口：package.json 的 build:css / build / watch 都必须走这里。

   为什么要预编译：Koishi 控制台 devMode 用宿主自己的 vite（没有任何 Tailwind 插件）
   直接加载本插件的 client/ 源码，`@import "tailwindcss"` 只会注入未编译的原始包 CSS，
   工具类永远不会生成——卡片会丢掉 bg-card / shadow-sm，HeroUI 的 tabs.css / tooltip.css
   里的 @apply 也不会展开，页签因此从横向胶囊退化成竖排文字。预编译成静态文件后，
   dev（宿主 vite）和 prod（本仓库 vite lib 构建）拿到的是同一份完整产物。

   CLI 产物不能直接使用：它的 @layer base（preflight）是无作用域的类型选择器，会重置
   整个 Koishi 控制台和同页其他插件的 UI。两条链路里漏掉后处理，开发环境或发布产物就会
   重新开始污染宿主。 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tailwindCli = resolve(root, '../../node_modules/@tailwindcss/cli/dist/index.mjs')
const input = 'client/styles/tailwind.source.css'
const outputRelative = 'client/styles/tailwind.generated.css'
const output = resolve(root, outputRelative)

function runTailwind() {
  return new Promise((fulfil, reject) => {
    const child = spawn(process.execPath, [tailwindCli, '-i', input, '-o', outputRelative], {
      cwd: root,
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) fulfil()
      else reject(new Error(`Tailwind CLI 失败（${signal ? `信号 ${signal}` : `退出码 ${code ?? 1}`}）`))
    })
  })
}

await runTailwind()

const generated = await readFile(output, 'utf8')
const { css, scopedRules, droppedRules } = scopePreflight(generated)
await writeFile(output, css)
console.log(`已限定 Tailwind preflight 作用域：改写 ${scopedRules} 条规则，丢弃 ${droppedRules} 条无法限定作用域的规则。`)
