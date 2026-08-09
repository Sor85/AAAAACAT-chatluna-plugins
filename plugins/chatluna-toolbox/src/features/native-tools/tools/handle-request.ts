/**
 * 好友与群申请处理工具
 * 通过 OneBot 申请 flag 同意或拒绝好友申请、加群申请和群邀请
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { Session } from "koishi";
import type { LogFn } from "../../../types";
import { ensureOneBotSession, callOneBotAPI } from "../onebot-api";
import { getSession } from "../session";
import { DEFAULT_HANDLE_REQUEST_TOOL_DESCRIPTION } from "../defaults";

interface OneBotResponseLike {
  status?: string;
  retcode?: number;
  wording?: string;
  message?: string;
}

export interface HandleRequestToolDeps {
  toolName: string;
  description: string;
  log?: LogFn;
}

export interface SendHandleRequestParams {
  session: Session | null;
  requestType: "friend" | "group";
  flag: string;
  approve: boolean;
  subType?: "add" | "invite";
  remark?: string;
  reason?: string;
  log?: LogFn;
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

  // OneBot 业务错误可能通过正常 resolve 的响应包返回，成功文案前必须检查状态与返回码。
  const reason = response.wording || response.message || response.status;
  const retcode =
    typeof response.retcode === "number"
      ? ` (retcode: ${response.retcode})`
      : "";
  throw new Error(`${reason || "OneBot returned failed"}${retcode}`);
}

export async function sendHandleRequest(
  params: SendHandleRequestParams,
): Promise<string> {
  try {
    const { session, requestType, approve, log } = params;
    const flag = params.flag.trim();
    if (!flag) return "request flag is required.";

    const { error, internal } = ensureOneBotSession(session);
    if (error) return error;

    if (requestType === "friend") {
      const result = await callOneBotAPI(
        internal!,
        "set_friend_add_request",
        {
          flag,
          approve,
          remark: params.remark?.trim() || "",
        },
        ["setFriendAddRequest"],
      );
      assertOneBotSuccess(result);

      const message = `已${approve ? "同意" : "拒绝"}好友申请 ${flag}。`;
      log?.("info", message);
      return message;
    }

    const subType = params.subType;
    if (!subType) {
      return "subType is required for group requests; use add or invite.";
    }

    const result = await callOneBotAPI(
      internal!,
      "set_group_add_request",
      {
        flag,
        sub_type: subType,
        approve,
        reason: params.reason?.trim() || "",
      },
      ["setGroupAddRequest"],
    );
    assertOneBotSuccess(result);

    const requestLabel = subType === "invite" ? "群邀请" : "加群申请";
    const message = `已${approve ? "同意" : "拒绝"}${requestLabel} ${flag}。`;
    log?.("info", message);
    return message;
  } catch (error) {
    params.log?.("warn", "handle_request failed", error);
    return `handle_request failed: ${(error as Error).message}`;
  }
}

export function createHandleRequestTool(
  deps: HandleRequestToolDeps,
): StructuredTool {
  const { toolName, description, log } = deps;

  // @ts-ignore
  return new (class extends StructuredTool {
    name = toolName || "handle_request";
    description = description || DEFAULT_HANDLE_REQUEST_TOOL_DESCRIPTION;
    schema = z
      .object({
        requestType: z
          .enum(["friend", "group"])
          .describe("Request type: friend or group."),
        flag: z.string().min(1).describe("OneBot request flag from the event."),
        approve: z
          .boolean()
          .describe("true to approve the request, false to reject it."),
        subType: z
          .enum(["add", "invite"])
          .optional()
          .describe("Required for group requests: add or invite."),
        remark: z
          .string()
          .optional()
          .describe("Optional friend remark when approving a friend request."),
        reason: z
          .string()
          .optional()
          .describe("Optional rejection reason for a group request."),
      })
      .strict();

    async _call(
      input: {
        requestType: "friend" | "group";
        flag: string;
        approve: boolean;
        subType?: "add" | "invite";
        remark?: string;
        reason?: string;
      },
      _manager?: unknown,
      runnable?: unknown,
    ) {
      return sendHandleRequest({
        session: getSession(runnable),
        ...input,
        log,
      });
    }
  })();
}
