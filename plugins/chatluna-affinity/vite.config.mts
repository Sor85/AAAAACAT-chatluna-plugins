/**
 * 前端构建配置
 * 构建 Affinity 控制台前端产物
 */

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
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
