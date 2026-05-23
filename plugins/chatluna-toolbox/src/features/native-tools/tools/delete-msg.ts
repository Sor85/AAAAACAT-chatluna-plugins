/**
 * 消息删除工具
 * 提供消息撤回能力
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { Session } from "koishi";
import type { LogFn } from "../../../types";
import { ensureOneBotSession, callOneBotAPI } from "../onebot-api";
import { getSession } from "../session";
import { DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION } from "../defaults";

interface OneBotResponseLike {
  status?: string;
  retcode?: number;
  wording?: string;
  message?: string;
}

export interface DeleteMessageToolDeps {
  toolName: string;
  description: string;
  log?: LogFn;
}

export interface SendDeleteMessageParams {
  session: Session | null;
  message_id: string;
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
  const reason = response.wording || response.message || response.status;
  const retcode =
    typeof response.retcode === "number" ? ` (retcode: ${response.retcode})` : "";
  throw new Error(`${reason || "OneBot returned failed"}${retcode}`);
}

export async function sendDeleteMessage(
  params: SendDeleteMessageParams,
): Promise<string> {
  const { session, message_id, log } = params;

  try {
    if (!session) return "No session context available.";

    const messageIdRaw = message_id.trim();
    if (!messageIdRaw) return "message_id is required.";

    const numericId = /^\d+$/.test(messageIdRaw)
      ? Number(messageIdRaw)
      : messageIdRaw;

    if (session.platform === "onebot") {
      const { error, internal } = ensureOneBotSession(session);
      if (error) return error;
      const result = await callOneBotAPI(
        internal!,
        "delete_msg",
        { message_id: numericId },
        ["deleteMsg"],
      );
      assertOneBotSuccess(result);
      const success = `Message deleted by ID ${messageIdRaw}.`;
      log?.("info", success);
      return success;
    }

    const bot = session.bot as unknown as {
      deleteMessage?: (channelId: string, messageId: string) => Promise<void>;
    };
    if (typeof bot?.deleteMessage === "function") {
      const channelId =
        session.channelId ||
        (session as unknown as { guildId?: string })?.guildId ||
        (session as unknown as { roomId?: string })?.roomId ||
        (session as unknown as { channel?: { id?: string } })?.channel?.id ||
        "";
      if (!channelId) return "Cannot determine channel to delete message.";
      await bot.deleteMessage(channelId, messageIdRaw);
      const success = `Message deleted by ID ${messageIdRaw}.`;
      log?.("info", success);
      return success;
    }

    return "Delete message is not supported on this platform.";
  } catch (error) {
    log?.("warn", "delete_msg failed", error);
    return `delete_msg failed: ${(error as Error).message}`;
  }
}

export function createDeleteMessageTool(deps: DeleteMessageToolDeps) {
  const { toolName, description, log } = deps;

  // @ts-ignore
  return new (class extends StructuredTool {
    name = toolName || "delete_msg";
    description = description || DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION;
    schema = z
      .object({
        message_id: z
          .string()
          .min(1, "message_id is required")
          .describe("Specific message ID to delete."),
      })
      .strict();

    async _call(
      input: { message_id: string },
      _manager?: unknown,
      runnable?: unknown,
    ) {
      try {
        const session = getSession(runnable);
        return await sendDeleteMessage({
          session,
          message_id: input.message_id,
          log,
        });
      } catch (error) {
        log?.("warn", "delete_msg failed", error);
        return `delete_msg failed: ${(error as Error).message}`;
      }
    }
  })() as StructuredTool;
}
