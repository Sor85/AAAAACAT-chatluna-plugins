/**
 * 前端构建配置
 * 构建 Toolbox 控制台前端产物
 */

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue()],
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
          "shared-nav": "sharedNav",
        },
        assetFileNames: "style.[ext]",
      },
    },
    cssCodeSplit: false,
  },
});
