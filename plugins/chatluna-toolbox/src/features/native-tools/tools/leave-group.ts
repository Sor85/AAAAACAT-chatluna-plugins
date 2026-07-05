/**
 * 退群工具
 * 让机器人退出指定群聊
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { Session } from "koishi";
import type { LogFn } from "../../../types";
import { ensureOneBotSession, callOneBotAPI } from "../onebot-api";
import { getSession } from "../session";
import { DEFAULT_LEAVE_GROUP_TOOL_DESCRIPTION } from "../defaults";

export interface LeaveGroupToolDeps {
  toolName: string;
  description: string;
  log?: LogFn;
}

export interface SendLeaveGroupParams {
  session: Session | null;
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

export async function sendLeaveGroup(
  params: SendLeaveGroupParams,
): Promise<string> {
  try {
    const { session, groupId, log } = params;
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

    await callOneBotAPI(
      internal!,
      "set_group_leave",
      { group_id: resolvedGroupId },
      ["setGroupLeave"],
    );

    const message = `已退出群 ${resolvedGroupId}。`;
    log?.("info", message);
    return message;
  } catch (error) {
    params.log?.("warn", "set_group_leave failed", error);
    return `set_group_leave failed: ${(error as Error).message}`;
  }
}

export function createLeaveGroupTool(deps: LeaveGroupToolDeps): StructuredTool {
  const { toolName, description, log } = deps;

  // @ts-ignore
  return new (class extends StructuredTool {
    name = toolName || "set_group_leave";
    description = description || DEFAULT_LEAVE_GROUP_TOOL_DESCRIPTION;
    schema = z.object({
      groupId: z
        .string()
        .optional()
        .describe("Target group ID. Defaults to current session group."),
    });

    async _call(
      input: { groupId?: string },
      _manager?: unknown,
      runnable?: unknown,
    ) {
      return sendLeaveGroup({
        session: getSession(runnable),
        groupId: input.groupId,
        log,
      });
    }
  })();
}
