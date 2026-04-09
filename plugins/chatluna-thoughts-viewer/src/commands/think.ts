/**
 * 思考指令注册
 * 提供查看当前思考与上次思考两条指令
 */

import type { Context } from "koishi";
import type { Config, ThinkStore } from "../types";
import { buildThoughtStoreKey } from "../store/think-store";

export interface RegisterThinkCommandParams {
  ctx: Context;
  config: Config;
  store: ThinkStore;
}

function appendAliases(
  command: { alias: (name: string) => unknown },
  aliases: string[],
): void {
  for (const alias of aliases) {
    const value = String(alias || "").trim();
    if (!value) continue;
    command.alias(value);
  }
}

export function registerThinkCommand(params: RegisterThinkCommandParams): void {
  const { ctx, config, store } = params;

  const currentCommandName =
    String(config.commandName || "查看思考").trim() || "查看思考";
  const previousCommandName =
    String(config.previousCommandName || "上次思考").trim() || "上次思考";

  const currentCommand = ctx
    .command(currentCommandName, "展示最近一次思考内容")
    .action(({ session }) => {
      const key = buildThoughtStoreKey(session);
      if (!key) return config.emptyMessage;

      const content = store.getCurrent(key);
      if (!content) return config.emptyMessage;

      return content;
    });
  appendAliases(currentCommand, config.commandAliases || []);

  const previousCommand = ctx
    .command(previousCommandName, "展示上一次思考内容")
    .action(({ session }) => {
      const key = buildThoughtStoreKey(session);
      if (!key) return config.emptyMessage;

      const content = store.getPrevious(key);
      if (!content) return config.emptyMessage;

      return content;
    });
  appendAliases(previousCommand, config.previousCommandAliases || []);
}
