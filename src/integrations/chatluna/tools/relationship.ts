/**
 * 关系调整工具
 * 为 ChatLuna 提供关系调整能力
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { ToolDependencies } from "./types";
import { getSession } from "./types";

export function createRelationshipTool(deps: ToolDependencies) {
  const { config, store, resolveUserIdentity } = deps;
  const levels = Array.isArray(config.relationshipAffinityLevels)
    ? config.relationshipAffinityLevels
        .map((item) =>
          item && item.relation
            ? { ...item, relation: String(item.relation).trim() }
            : null,
        )
        .filter(Boolean)
    : [];
  const summary = levels
    .map((item) => `${item!.relation}: ${item!.min}-${item!.max}`)
    .join(" | ");

  // @ts-expect-error - Type instantiation depth issue with zod + StructuredTool
  return new (class extends StructuredTool {
    name = "relationship";
    description =
      "Set relationship for a user and align affinity to the relationship lower bound.";
    schema = z.object({
      relation: z
        .string()
        .min(1, "Relation cannot be empty")
        .describe(
          summary
            ? `Target relation (configured: ${summary})`
            : "Target relation name",
        ),
      targetUserId: z
        .string()
        .optional()
        .describe("Target user ID; defaults to current session"),
      platform: z
        .string()
        .optional()
        .describe("Target platform; defaults to current session"),
    });

    async _call(
      input: { relation: string; targetUserId?: string; platform?: string },
      _manager?: unknown,
      runnable?: unknown,
    ) {
      const session = getSession(runnable);
      const platform = input.platform || session?.platform;
      const userId = input.targetUserId || session?.userId;
      if (!platform || !userId)
        return "Missing platform or user ID. Unable to adjust relationship.";

      let nickname: string | undefined;
      const isTargetUser = userId === session?.userId;
      if (session && !isTargetUser) {
        const identity = await resolveUserIdentity(session, userId);
        nickname = identity?.nickname;
      }

      const relationName = input.relation.trim();
      await store.save(
        {
          platform,
          userId,
          selfId: session?.selfId,
          session: isTargetUser ? session : undefined,
          nickname,
        },
        NaN,
        relationName,
      );
      return `Relationship for ${platform}/${userId} set to ${relationName}.`;
    }
  })();
}
