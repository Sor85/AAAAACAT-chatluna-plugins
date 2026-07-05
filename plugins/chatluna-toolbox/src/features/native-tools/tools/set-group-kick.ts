/**
 * 群成员踢出工具
 * 提供踢出群成员能力
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { Session } from "koishi";
import type { LogFn } from "../../../types";
import { ensureOneBotSession, callOneBotAPI } from "../onebot-api";
import { getSession } from "../session";
import { DEFAULT_SET_GROUP_KICK_TOOL_DESCRIPTION } from "../defaults";

export interface SetGroupKickToolDeps {
  toolName: string;
  description: string;
  log?: LogFn;
}

export interface SendGroupKickParams {
  session: Session | null;
  userId: string;
  groupId?: string;
  log?: LogFn;
}

function resolveGroupId(session: Session, groupId?: string): string {
  return (
    groupId?.trim() ||
    (session.guildId ? String(session.guildId).trim() : "") ||
    (session.channelId ? String(session.channelId).trim() : "")
  );
}

export async function sendGroupKick(
  params: SendGroupKickParams,
): Promise<string> {
  try {
    const { session, userId, groupId, log } = params;
    const {
      error,
      internal,
      session: validatedSession,
    } = ensureOneBotSession(session);
    if (error) return error;

    const resolvedGroupId = resolveGroupId(validatedSession!, groupId);
    if (!resolvedGroupId) {
      return "Missing groupId. Provide groupId explicitly or run inside a group session.";
    }

    const userIdRaw = userId.trim();
    if (!userIdRaw) return "userId is required.";

    await callOneBotAPI(
      internal!,
      "set_group_kick",
      { group_id: resolvedGroupId, user_id: userIdRaw },
      ["setGroupKick"],
    );

    const message = `已将用户 ${userIdRaw} 移出群 ${resolvedGroupId}。`;
    log?.("info", message);
    return message;
  } catch (error) {
    params.log?.("warn", "set_group_kick failed", error);
    return `set_group_kick failed: ${(error as Error).message}`;
  }
}

export function createSetGroupKickTool(
  deps: SetGroupKickToolDeps,
): StructuredTool {
  const { toolName, description, log } = deps;

  // @ts-ignore
  return new (class extends StructuredTool {
    name = toolName || "set_group_kick";
    description = description || DEFAULT_SET_GROUP_KICK_TOOL_DESCRIPTION;
    schema = z.object({
      groupId: z
        .string()
        .optional()
        .describe("Target group ID. Defaults to current session group."),
      userId: z
        .string()
        .min(1, "userId is required")
        .describe("Target member user ID."),
    });

    async _call(
      input: { groupId?: string; userId: string },
      _manager?: unknown,
      runnable?: unknown,
    ) {
      return sendGroupKick({
        session: getSession(runnable),
        groupId: input.groupId,
        userId: input.userId,
        log,
      });
    }
  })();
}
