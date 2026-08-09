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

interface OneBotResponseLike {
  status?: string;
  retcode?: number;
  wording?: string;
  message?: string;
}

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

function assertOneBotSuccess(result: unknown): void {
  const response = result as OneBotResponseLike | undefined;
  if (!response || typeof response !== "object") return;

  const status = String(response.status || "").toLowerCase();
  const failed =
    status === "failed" ||
    (!!status && status !== "ok") ||
    (typeof response.retcode === "number" && response.retcode !== 0);
  if (!failed) return;

  // OneBot 业务错误可能以正常 resolve 的响应包返回，不能只依赖 Promise rejection 判断退群成功。
  const reason = response.wording || response.message || response.status;
  const retcode =
    typeof response.retcode === "number"
      ? ` (retcode: ${response.retcode})`
      : "";
  throw new Error(`${reason || "OneBot returned failed"}${retcode}`);
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

    const result = await callOneBotAPI(
      internal!,
      "set_group_leave",
      { group_id: resolvedGroupId },
      ["setGroupLeave"],
    );
    assertOneBotSuccess(result);

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
