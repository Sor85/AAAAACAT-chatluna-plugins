/**
 * 前端构建配置
 * 构建 Affinity 控制台前端产物
 */

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig({
  // 刻意不挂 @tailwindcss/vite：Tailwind 由 yarn build:css 预编译成
  // client/styles/tailwind.generated.css，dev（宿主 vite）与 prod 共用同一份产物。
  // 详见 scripts/build-css.mjs。
  plugins: [vue()],
  // React 生态依赖会在浏览器端读取 process.env.NODE_ENV；Koishi 控制台没有注入 process，需要在构建期直接内联。
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  esbuild: {
    jsx: "automatic",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "client/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["vue", "@koishijs/client"],
      output: {
        globals: {
          vue: "Vue",
          "@koishijs/client": "client",
        },
        assetFileNames: "style.[ext]",
      },
    },
    cssCodeSplit: false,
  },
});
