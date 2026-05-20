/**
 * QQ 头像设置工具
 * 提供机器人账号头像修改能力。
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { Context, Session } from "koishi";
import type { LogFn } from "../../../types";
import { ensureOneBotSession, callOneBotAPI } from "../onebot-api";
import { getSession } from "../session";
import { DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION } from "../defaults";

export interface SetQQAvatarToolDeps {
  ctx?: Context;
  toolName: string;
  description: string;
  log?: LogFn;
}

export interface SendSetQQAvatarParams {
  ctx?: Context;
  session: Session | null;
  imageUrl: string;
  log?: LogFn;
}

interface OneBotResponseLike {
  status?: string;
  retcode?: number;
  wording?: string;
  message?: string;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === "string") return Buffer.from(data);
  throw new Error("unsupported image response body.");
}

async function fetchImageAsOneBotFile(
  ctx: Context | undefined,
  imageUrl: string,
): Promise<string> {
  if (!isHttpUrl(imageUrl)) return imageUrl;

  try {
    const http = (ctx as unknown as {
      http?: {
        get?: (url: string, config?: Record<string, unknown>) => Promise<unknown>;
      };
    })?.http;
    const data =
      typeof http?.get === "function"
        ? await http.get(imageUrl, { responseType: "arraybuffer" })
        : await fetch(imageUrl).then(async (response) => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            return response.arrayBuffer();
          });
    return `base64://${toBuffer(data).toString("base64")}`;
  } catch (error) {
    throw new Error(`无法读取头像图片：${(error as Error).message}`);
  }
}

function assertOneBotSuccess(result: unknown): void {
  const response = result as OneBotResponseLike | undefined;
  if (!response || typeof response !== "object") return;
  const failed =
    response.status === "failed" ||
    (typeof response.retcode === "number" && response.retcode !== 0);
  if (!failed) return;
  const reason = response.wording || response.message || response.status;
  const retcode =
    typeof response.retcode === "number" ? ` (retcode: ${response.retcode})` : "";
  throw new Error(`${reason || "OneBot returned failed"}${retcode}`);
}

export async function sendSetQQAvatar(
  params: SendSetQQAvatarParams,
): Promise<string> {
  const { ctx, session, log } = params;

  try {
    const imageUrl = params.imageUrl.trim();
    if (!imageUrl) return "imageUrl is required.";

    const { error, internal } = ensureOneBotSession(session);
    if (error) return error;

    const file = await fetchImageAsOneBotFile(ctx, imageUrl);
    const result = await callOneBotAPI(internal!, "set_qq_avatar", { file }, [
      "setQQAvatar",
    ]);
    assertOneBotSuccess(result);
    const message = "QQ 头像已更新。";
    log?.("info", message);
    return message;
  } catch (error) {
    log?.("warn", "set_qq_avatar failed", error);
    return `set_qq_avatar failed: ${(error as Error).message}`;
  }
}

export function createSetQQAvatarTool(deps: SetQQAvatarToolDeps) {
  const { ctx, toolName, description, log } = deps;

  // @ts-ignore
  return new (class extends StructuredTool {
    name = toolName || "set_qq_avatar";
    description = description || DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION;
    schema = z.object({
      imageUrl: z
        .string()
        .min(1, "imageUrl is required")
        .describe("Image URL or local file path readable by the OneBot side."),
    });

    async _call(
      input: { imageUrl: string },
      _manager?: unknown,
      runnable?: unknown,
    ) {
      return sendSetQQAvatar({
        session: getSession(runnable),
        imageUrl: input.imageUrl,
        ctx,
        log,
      });
    }
  })();
}
