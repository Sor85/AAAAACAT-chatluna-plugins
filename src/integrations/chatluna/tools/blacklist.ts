/**
 * 黑名单调整工具
 * 为 ChatLuna 提供黑名单管理能力
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { ToolDependencies } from "./types";
import { getSession } from "./types";

export function createBlacklistTool(deps: ToolDependencies) {
  const { config, store, cache, clamp, blacklist } = deps;

  // @ts-expect-error - Type instantiation depth issue with zod + StructuredTool
  return new (class extends StructuredTool {
    name = "blacklist";
    description = "Add or remove a user from permanent or temporary blacklist.";
    schema = z.object({
      action: z.enum(["add", "remove"]).describe("Action: add or remove"),
      mode: z
        .enum(["permanent", "temporary"])
        .default("permanent")
        .describe("Blacklist mode: permanent or temporary"),
      targetUserId: z.string().describe("Target user ID"),
      platform: z
        .string()
        .optional()
        .describe("Target platform; defaults to current session"),
      note: z.string().optional().describe("Optional note"),
      durationHours: z
        .number()
        .optional()
        .describe(
          "Duration in hours when mode=temporary and action=add (default: from config)",
        ),
    });

    async _call(
      input: {
        action: "add" | "remove";
        mode: "permanent" | "temporary";
        targetUserId: string;
        platform?: string;
        note?: string;
        durationHours?: number;
      },
      _manager?: unknown,
      runnable?: unknown,
    ) {
      const session = getSession(runnable);
      const platform = input.platform || session?.platform;
      const userId = input.targetUserId;
      const channelId =
        (session as unknown as { guildId?: string })?.guildId ||
        session?.channelId ||
        (session as unknown as { roomId?: string })?.roomId ||
        "";
      if (!platform || !userId)
        return "Missing platform or user ID. Unable to adjust blacklist.";

      if (input.mode === "temporary") {
        if (input.action === "remove") {
          const removed = await blacklist.removeTemporary(platform, userId);
          cache.clear(platform, userId);
          return removed
            ? `User ${platform}/${userId} removed from temporary blacklist.`
            : `User ${platform}/${userId} not found in temporary blacklist.`;
        }

        const durationRaw = Number(input.durationHours);
        if (!Number.isFinite(durationRaw) || durationRaw < 1) {
          return "Missing or invalid durationHours for temporary blacklist add action.";
        }
        const durationHours = Math.max(1, durationRaw);
        const penalty = Math.max(
          0,
          Number(config.shortTermBlacklistPenalty ?? 5),
        );

        let nickname = "";
        if (session?.selfId) {
          try {
            const existing = await store.load(session.selfId, userId);
            nickname = existing?.nickname || "";
          } catch {
            /* ignore */
          }
        }

        const entry = await blacklist.recordTemporary(
          platform,
          userId,
          durationHours,
          penalty,
          {
            note: input.note ?? "tool",
            nickname,
            channelId,
          },
        );
        if (!entry)
          return `User ${platform}/${userId} is already in temporary blacklist.`;

        if (session?.selfId && penalty > 0) {
          try {
            const record = await store.load(session.selfId, userId);
            if (record) {
              const newAffinity = clamp(
                (record.longTermAffinity ?? record.affinity) - penalty,
              );
              await store.save(
                { platform, userId, selfId: session.selfId, session },
                newAffinity,
                record.relation || "",
              );
            }
          } catch {
            /* ignore */
          }
        }

        cache.clear(platform, userId);
        return `User ${platform}/${userId} added to temporary blacklist for ${durationHours} hours.`;
      }

      if (input.action === "add") {
        let nickname = "";
        if (session?.selfId) {
          try {
            const existing = await store.load(session.selfId, userId);
            nickname = existing?.nickname || "";
          } catch {
            /* ignore */
          }
        }
        await blacklist.recordPermanent(platform, userId, {
          note: input.note ?? "tool",
          nickname,
          channelId,
        });
        cache.clear(platform, userId);
        return `User ${platform}/${userId} added to blacklist.`;
      }

      const removed = await blacklist.removePermanent(
        platform,
        userId,
        channelId,
      );
      cache.clear(platform, userId);
      return removed
        ? `User ${platform}/${userId} removed from blacklist.`
        : `User ${platform}/${userId} not found in blacklist.`;
    }
  })();
}
