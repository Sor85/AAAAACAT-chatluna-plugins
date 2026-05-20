/**
 * 群成员专属头衔工具
 * 提供修改或清除群成员专属头衔能力
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { Session } from "koishi";
import type { LogFn, OneBotProtocol } from "../../../types";
import { ensureOneBotSession, callOneBotAPI } from "../onebot-api";
import { getSession } from "../session";
import { DEFAULT_SET_GROUP_SPECIAL_TITLE_TOOL_DESCRIPTION } from "../defaults";

export interface SetGroupSpecialTitleToolDeps {
  toolName: string;
  description: string;
  protocol: OneBotProtocol;
  log?: LogFn;
}

export interface SendSetGroupSpecialTitleParams {
  session: Session | null;
  userId: string;
  title: string;
  groupId?: string;
  protocol: OneBotProtocol;
  log?: LogFn;
}

function resolveGroupId(session: Session, groupId?: string): string {
  return (
    groupId?.trim() ||
    ((session as unknown as { guildId?: string }).guildId || "").trim() ||
    (session.channelId || "").trim() ||
    (((session as unknown as { roomId?: string }).roomId || "").trim())
  );
}

export async function sendSetGroupSpecialTitle(
  params: SendSetGroupSpecialTitleParams,
): Promise<string> {
  try {
    const { session, userId, groupId, title, log } = params;
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

    const titleRaw = title.trim();
    await callOneBotAPI(
      internal!,
      "set_group_special_title",
      {
        group_id: resolvedGroupId,
        user_id: userIdRaw,
        special_title: titleRaw,
      },
      ["setGroupSpecialTitle"],
    );

    const message = titleRaw
      ? `群专属头衔已更新：${userIdRaw} -> ${titleRaw}`
      : `群专属头衔已清除：${userIdRaw}`;
    log?.("info", message);
    return message;
  } catch (error) {
    params.log?.("warn", "set_group_special_title failed", error);
    return `set_group_special_title failed: ${(error as Error).message}`;
  }
}

export function createSetGroupSpecialTitleTool(
  deps: SetGroupSpecialTitleToolDeps,
): StructuredTool {
  const { toolName, description, protocol, log } = deps;

  // @ts-ignore
  return new (class extends StructuredTool {
    name = toolName || "set_group_special_title";
    description =
      description || DEFAULT_SET_GROUP_SPECIAL_TITLE_TOOL_DESCRIPTION;
    schema = z.object({
      groupId: z
        .string()
        .optional()
        .describe("Target group ID. Defaults to current session group."),
      userId: z
        .string()
        .min(1, "userId is required")
        .describe("Target member user ID."),
      title: z
        .string()
        .describe("New special title. Use an empty string to clear it."),
    });

    async _call(
      input: { groupId?: string; userId: string; title: string },
      _manager?: unknown,
      runnable?: unknown,
    ) {
      const session = getSession(runnable);
      return sendSetGroupSpecialTitle({
        session,
        userId: input.userId,
        title: input.title,
        groupId: input.groupId,
        protocol,
        log,
      });
    }
  })();
}
