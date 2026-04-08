/**
 * 插件入口
 * 负责声明插件信息、配置模型与命令注册
 */

import * as path from "path";
import type { Context } from "koishi";
import {
  ConfigSchema,
  defaultConfig,
  type Config as PluginConfig,
} from "./config";
import { registerCommands } from "./command/register";

export const name = "koishi-plugin-chatluna-meme-generator";

export const inject = {
  required: ["http"],
  optional: ["notifier", "puppeteer", "chatluna_character"],
};

export const Config = ConfigSchema;

export function apply(ctx: Context, config: PluginConfig): void {
  const mergedConfig: PluginConfig = {
    ...defaultConfig,
    ...config,
  };

  ctx.inject(["console"], (innerCtx) => {
    const consoleService = (
      innerCtx as unknown as {
        console?: { addEntry?: (entry: unknown) => void };
      }
    ).console;
    consoleService?.addEntry?.({
      dev: path.resolve(__dirname, "../client/index.ts"),
      prod: path.resolve(__dirname, "../dist"),
    });
  });

  registerCommands(ctx, mergedConfig);
}
export const usage = `
## 额外表情仓库

如果你自建了 meme-generator 服务，可以安装以下额外表情仓库来扩展更多表情：

- [meme-generator-contrib](https://github.com/MemeCrafters/meme-generator-contrib)
- [meme_emoji](https://github.com/anyliew/meme_emoji)
- [meme-generator-jj](https://github.com/jinjiao007/meme-generator-jj)
- [meme_emoji_nsfw](https://github.com/anyliew/meme_emoji_nsfw)
- [tudou-meme](https://github.com/LRZ9712/tudou-meme)
`;
