/**
 * register 模块内部类型
 * 收敛命令注册链路与 XML runtime 复用的上下文结构
 */

import type { Context } from "koishi";
import type { MemeInfoResponse } from "../../types";

export interface HttpLikeError {
  response?: {
    status?: number;
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

export interface FrontendNotifier {
  update(payload: { type: "success"; content: string }): void;
}

export interface PuppeteerLike {
  render(
    content: string,
    callback?: (
      page: {
        $: (selector: string) => Promise<unknown>;
        evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
      },
      next: (handle?: unknown) => Promise<string>,
    ) => Promise<string>,
  ): Promise<string>;
}

export interface ContextWithOptionalServices extends Context {
  notifier?: {
    create(): FrontendNotifier;
  };
  puppeteer?: PuppeteerLike;
}

export interface ChatlunaCompletionMessageLike {
  _getType?: () => string;
  type?: string;
  role?: string;
  content?: unknown;
  text?: string;
}

export interface ChatlunaCompletionMessagesLike extends Array<unknown> {
  push: (...items: unknown[]) => number;
}

export interface ChatlunaTempLike {
  completionMessages?: ChatlunaCompletionMessagesLike;
}

export type MaybePromise<T> = T | Promise<T>;

export interface ChatlunaCharacterServiceLike {
  getTemp?: (...args: unknown[]) => MaybePromise<ChatlunaTempLike | undefined>;
}

export interface ContextWithChatlunaCharacter extends Context {
  chatluna_character?: ChatlunaCharacterServiceLike;
}

export interface OneBotLikeInternalEvent {
  post_type?: unknown;
  notice_type?: unknown;
  sub_type?: unknown;
  target_id?: unknown;
  self_id?: unknown;
  user_id?: unknown;
  operator_id?: unknown;
  group_id?: unknown;
}

export interface ElementLike {
  type?: string;
  attrs?: {
    id?: unknown;
    name?: unknown;
    userId?: unknown;
    qq?: unknown;
  };
  children?: ElementLike[];
}

export interface MemeListInfoResult {
  key: string;
  info?: MemeInfoResponse;
}

export type MemeListCategory =
  | "no-args"
  | "text-only"
  | "image-only"
  | "image-and-text"
  | "unknown";

export interface MemeListEntry {
  alias: string;
  category: MemeListCategory;
}

export interface MemeListSection {
  title: string;
  aliases: string[];
}

export const MEME_LIST_CATEGORY_ORDER: MemeListCategory[] = [
  "no-args",
  "text-only",
  "image-only",
  "image-and-text",
  "unknown",
];

export const MEME_LIST_CATEGORY_LABEL: Record<MemeListCategory, string> = {
  "no-args": "无需参数",
  "text-only": "仅需文字",
  "image-only": "仅需图片",
  "image-and-text": "图片+文字",
  unknown: "信息获取失败",
};
