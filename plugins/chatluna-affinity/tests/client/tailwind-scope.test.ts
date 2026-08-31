/*
  守卫测试：Tailwind 必须预编译，且产物里的 preflight 必须限定在本插件渲染根内。

  两种失效形态都是静默的：
  - 没预编译 → 控制台 devMode 拿不到工具类，卡片丢白底、页签竖排（看起来像"工具类半残"）
  - preflight 没作用域 → 抹平整个控制台所有插件配置页标题的粗体（只来自 UA 默认样式）
*/

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import postcss from "postcss";
// @ts-expect-error 构建脚本是 .mjs，没有类型声明
import { scopePreflight } from "../../scripts/scope-preflight.mjs";
// @ts-expect-error 同上
import {
  AFFINITY_SCOPE_CLASS,
  AFFINITY_STYLE_ROOTS,
} from "../../scripts/affinity-style-roots.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative: string) =>
  readFileSync(resolve(pluginRoot, relative), "utf8");
/** 注释里会引用反面写法（`@import "tailwindcss"`），断言必须只看真实规则 */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const styleCss = stripComments(read("client/style.css"));
const sourceCss = stripComments(read("client/styles/tailwind.source.css"));
const viteConfig = read("vite.config.mts");
const generatedPath = resolve(pluginRoot, "client/styles/tailwind.generated.css");

const SCOPE = `:where(${AFFINITY_STYLE_ROOTS.join(", ")})`;

describe("Tailwind 预编译与 preflight 作用域", () => {
  it("style.css 只引入预编译产物，不自己引入 tailwindcss", () => {
    assert.match(styleCss, /@import\s+["']\.\/styles\/tailwind\.generated\.css["']/);
    assert.ok(
      !/@import\s+["']tailwindcss/.test(styleCss),
      "style.css 由宿主 vite 加载，引入 tailwindcss 既编译不出工具类又会泄漏全局 preflight",
    );
  });

  it("需要 Tailwind 编译的样式包都在 tailwind.source.css 里", () => {
    // 这些包含 @apply / @utility / @theme，交给宿主 vite 会原样输出
    for (const pkg of [
      "tw-animate-css",
      "@heroui/styles/themes/default",
      "@heroui/styles/utilities",
      "@heroui/styles/components/tabs.css",
      "@heroui/styles/components/tooltip.css",
    ]) {
      assert.ok(
        sourceCss.includes(pkg),
        `${pkg} 含 Tailwind 指令，必须放进 tailwind.source.css`,
      );
      assert.ok(
        !styleCss.includes(pkg),
        `${pkg} 不能留在 style.css，宿主 vite 不会展开它的 @apply`,
      );
    }

    assert.match(sourceCss, /@import\s+["']tailwindcss["']\s+source\(none\)/);
    assert.match(sourceCss, /@theme inline/);
  });

  it("vite 配置不再挂 @tailwindcss/vite", () => {
    assert.ok(
      !/@tailwindcss\/vite/.test(viteConfig.replace(/\/\/.*$/gm, "")),
      "prod 也必须消费同一份预编译产物，否则 dev 与 prod 观感会再次分叉",
    );
  });

  it("scopePreflight 用 :where() 限定作用域并丢弃无法限定的规则", () => {
    const input = [
      "@layer base {",
      "  *, ::after, ::backdrop { box-sizing: border-box }",
      "  html, :host { font-family: sans-serif }",
      "  h1, h2 { font-weight: inherit }",
      "  ::placeholder { opacity: 1 }",
      "}",
    ].join("\n");

    const { css, scopedRules, droppedRules } = scopePreflight(input);

    assert.equal(droppedRules, 1, "html,:host 整条必须丢弃");
    assert.equal(scopedRules, 3);
    assert.ok(!/font-family: sans-serif/.test(css));
    // `*` 要同时覆盖渲染根自身与后代
    assert.ok(css.includes(`${SCOPE},`) && css.includes(`${SCOPE} *`));
    assert.ok(css.includes(`${SCOPE} h1`) && css.includes(`${SCOPE} h2`));
    assert.ok(css.includes(`${SCOPE}::placeholder`));
    // :where() 不贡献特异性，preflight 必须留在最低层
    assert.ok(!/(^|[^:])\.affinity-tw-scope h1/.test(css));
  });

  it("作用域类挂在全部渲染根上，包括 portal 浮层", () => {
    const dashboard = read("client/dashboard/AffinityDashboard.tsx");
    const sonner = read("client/components/ui/sonner.tsx");

    assert.match(
      dashboard,
      new RegExp(`className="affinity-dashboard ${AFFINITY_SCOPE_CLASS}"`),
    );
    // HeroUI Tooltip 走 react-aria Overlay，portal 到 body，不在页面容器的继承树里
    assert.match(
      dashboard,
      new RegExp(`<Tooltip\\.Content[^>]*className="${AFFINITY_SCOPE_CLASS}"`),
    );
    assert.match(sonner, new RegExp(`className="toaster group ${AFFINITY_SCOPE_CLASS}"`));
  });

  it("预编译产物里 @layer base 的每条规则都带作用域", (t) => {
    if (!existsSync(generatedPath)) {
      t.skip("tailwind.generated.css 尚未生成，先运行 yarn build:css");
      return;
    }

    const ast = postcss.parse(readFileSync(generatedPath, "utf8"));
    const offenders: string[] = [];
    let baseLayerFound = false;

    ast.walkAtRules("layer", (layer) => {
      if (layer.params !== "base" || !layer.nodes) return;
      baseLayerFound = true;
      layer.walkRules((rule) => {
        // 原生嵌套的子规则由父选择器带作用域，不重复检查
        if (rule.parent?.type === "rule") return;
        for (const selector of rule.selectors) {
          if (!selector.startsWith(":where(")) offenders.push(selector);
        }
      });
    });

    assert.ok(baseLayerFound, "产物里找不到 @layer base，preflight 作用域改写可能没生效");
    assert.deepEqual(
      offenders,
      [],
      `产物 @layer base 出现未作用域的选择器：${offenders.join(" | ")}`,
    );
  });
});
