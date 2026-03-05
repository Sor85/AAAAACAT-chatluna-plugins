/**
 * 清空数据库命令
 * 清空所有好感度数据（危险操作，需二次确认）
 */

import type { CommandDependencies } from "./types";
import { MODEL_NAME, BLACKLIST_MODEL_NAME } from "../models";

export function registerClearAllCommand(deps: CommandDependencies) {
  const { ctx, log, cache } = deps;
  const pendingClearConfirmations = new Map<string, { expiresAt: number }>();

  ctx
    .command("affinity.clearAll", "清空所有好感度数据（危险操作）", {
      authority: 4,
    })
    .alias("清空好感度")
    .option("confirm", "-y 确认清空")
    .action(async ({ session, options }) => {
      if (!session) return "无法获取会话信息。";
      const sessionKey = `${session.platform}:${session.userId}`;
      const now = Date.now();

      const pending = pendingClearConfirmations.get(sessionKey);
      if (pending && pending.expiresAt > now && options?.confirm) {
        pendingClearConfirmations.delete(sessionKey);
        try {
          await ctx.database.remove(MODEL_NAME, {});
          await ctx.database.remove(BLACKLIST_MODEL_NAME, {});
          cache.clearAll?.();
          log("info", "好感度与黑名单数据库已清空", {
            operator: session.userId,
            platform: session.platform,
          });
          return "✅ 已成功清空所有好感度与黑名单数据。";
        } catch (error) {
          log("warn", "清空数据库失败", error);
          return "❌ 清空数据库时发生错误，请查看日志。";
        }
      }

      pendingClearConfirmations.set(sessionKey, { expiresAt: now + 60 * 1000 });
      return "⚠️ 警告：此操作将永久删除所有好感度数据，且无法恢复！\n请在 60 秒内使用 `affinity.clearAll -y` 或 `清空好感度 -y` 确认执行。";
    });
}
