/**
 * meme.list 构建与渲染
 * 负责模板信息拉取、分类分段与文本/图片输出
 */

import { h, type Context } from "koishi";
import type { Config } from "../../config";
import { MemeBackendClient } from "../../infra/client";
import type { MemeInfoResponse } from "../../types";
import { normalizeMemeKey, resolveSessionGroupId } from "./exclusion";
import {
  type ContextWithOptionalServices,
  MEME_LIST_CATEGORY_LABEL,
  MEME_LIST_CATEGORY_ORDER,
  type MemeListCategory,
  type MemeListEntry,
  type MemeListInfoResult,
  type MemeListSection,
} from "./types";

export const MEME_LIST_TEXT_CHUNK_BYTE_LIMIT = 3000;
export const MEME_SEARCH_RESULT_LIMIT = 30;

interface MemeSearchResult {
  alias: string;
}

interface OneBotForwardInternal {
  _request?: (
    action: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>;
  [key: string]: unknown;
}

interface OneBotForwardSession {
  platform?: string;
  userId?: string;
  selfId?: string;
  channelId?: string;
  guildId?: string;
  groupId?: string;
  roomId?: string;
  event?: {
    message_type?: string;
    guild?: { id?: string };
    group?: { id?: string };
    channel?: { id?: string };
    user?: { id?: string };
  };
  bot?: {
    internal?: OneBotForwardInternal;
    selfId?: string;
    user?: {
      id?: unknown;
      name?: unknown;
      nick?: unknown;
      nickname?: unknown;
      username?: unknown;
    };
    name?: string;
    nick?: string;
    nickname?: string;
    username?: string;
  };
}

type ForwardTarget =
  | { type: "group"; id: string | number }
  | { type: "private"; id: string | number };

function toOneBotId(value: unknown): string | number | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;

  const numeric = Number(text);
  if (/^\d+$/.test(text) && Number.isSafeInteger(numeric)) return numeric;
  return text;
}

function resolveOneBotForwardTarget(
  session: OneBotForwardSession,
): ForwardTarget | undefined {
  const normalizedGroupId = toOneBotId(resolveSessionGroupId(session));
  if (normalizedGroupId) return { type: "group", id: normalizedGroupId };

  const userId =
    session.userId ||
    session.event?.user?.id ||
    (session.event?.message_type === "private" ? session.channelId : "") ||
    "";
  const normalizedUserId = toOneBotId(userId);
  if (normalizedUserId) return { type: "private", id: normalizedUserId };

  return undefined;
}

function resolveForwardSender(session: OneBotForwardSession): {
  id: string | number;
  name: string;
} {
  const user = session.bot?.user;
  const id =
    toOneBotId(user?.id) ||
    toOneBotId(session.selfId) ||
    toOneBotId(session.bot?.selfId) ||
    0;
  const name =
    String(
      user?.name ||
        user?.nick ||
        user?.nickname ||
        user?.username ||
        session.bot?.name ||
        session.bot?.nick ||
        session.bot?.nickname ||
        session.bot?.username ||
        "meme.list",
    ).trim() || "meme.list";

  return { id, name };
}

function appendChunk(
  chunks: string[],
  current: string,
  next: string,
): string {
  if (!next) return current;
  if (!current) return next;
  if (
    Buffer.byteLength(`${current}\n${next}`, "utf8") <=
    MEME_LIST_TEXT_CHUNK_BYTE_LIMIT
  ) {
    return `${current}\n${next}`;
  }
  chunks.push(current);
  return next;
}

function splitLongLine(line: string): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const word of line.split(/\s+/).filter(Boolean)) {
    if (Buffer.byteLength(word, "utf8") > MEME_LIST_TEXT_CHUNK_BYTE_LIMIT) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      let chunk = "";
      for (const char of word) {
        if (
          chunk &&
          Buffer.byteLength(`${chunk}${char}`, "utf8") >
            MEME_LIST_TEXT_CHUNK_BYTE_LIMIT
        ) {
          chunks.push(chunk);
          chunk = "";
        }
        chunk += char;
      }
      if (chunk) chunks.push(chunk);
      continue;
    }

    if (!current) {
      current = word;
      continue;
    }
    if (
      Buffer.byteLength(`${current} ${word}`, "utf8") <=
      MEME_LIST_TEXT_CHUNK_BYTE_LIMIT
    ) {
      current = `${current} ${word}`;
    } else {
      chunks.push(current);
      current = word;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function splitMemeListText(content: string): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const line of content.split("\n")) {
    if (Buffer.byteLength(line, "utf8") <= MEME_LIST_TEXT_CHUNK_BYTE_LIMIT) {
      current = appendChunk(chunks, current, line);
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }
    chunks.push(...splitLongLine(line));
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [content];
}

export function splitMemeListMessages(sections: MemeListSection[]): string[] {
  const chunks: string[] = [];

  for (const section of sections) {
    chunks.push(section.title);
    chunks.push(...splitMemeListText(section.aliases.join(" ")));
  }

  return chunks;
}

function createForwardMessages(
  session: OneBotForwardSession,
  sections: MemeListSection[],
) {
  const sender = resolveForwardSender(session);
  return splitMemeListMessages(sections).map((chunk) => ({
    type: "node",
    data: {
      name: sender.name,
      uin: sender.id,
      content: chunk,
    },
  }));
}

function toInternalMethodName(action: string): string {
  return action.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

async function callOneBotAction(
  internal: OneBotForwardInternal,
  action: string,
  params: Record<string, unknown>,
): Promise<void> {
  if (typeof internal._request === "function") {
    await internal._request(action, params);
    return;
  }

  const methodName = toInternalMethodName(action);
  const method = internal[methodName] || internal[action];
  if (typeof method !== "function") {
    throw new Error(`OneBot adapter does not support ${action}`);
  }

  await (method as (params: Record<string, unknown>) => Promise<unknown>)(
    params,
  );
}

async function tryOneBotActions(
  internal: OneBotForwardInternal,
  attempts: Array<{ action: string; params: Record<string, unknown> }>,
): Promise<void> {
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      await callOneBotAction(internal, attempt.action, attempt.params);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function createOneBotForwardAttempts(
  target: ForwardTarget,
  baseParams: Record<string, unknown>,
): Array<{ action: string; params: Record<string, unknown> }> {
  return target.type === "group"
    ? [
        {
          action: "send_group_forward_msg",
          params: { group_id: target.id, ...baseParams },
        },
        {
          action: "send_forward_msg",
          params: {
            message_type: "group",
            group_id: target.id,
            ...baseParams,
          },
        },
      ]
    : [
        {
          action: "send_private_forward_msg",
          params: { user_id: target.id, ...baseParams },
        },
        {
          action: "send_forward_msg",
          params: {
            message_type: "private",
            user_id: target.id,
            ...baseParams,
          },
        },
      ];
}

export async function sendMemeListForwardMessage(
  session: unknown,
  sections: MemeListSection[],
  logger: ReturnType<Context["logger"]>,
): Promise<boolean> {
  const oneBotSession = session as OneBotForwardSession | undefined;
  if (oneBotSession?.platform !== "onebot") return false;

  const internal = oneBotSession.bot?.internal;
  if (!internal) return false;

  const target = resolveOneBotForwardTarget(oneBotSession);
  if (!target) return false;

  const messages = createForwardMessages(oneBotSession, sections);
  const baseParams = { messages };
  const attempts = createOneBotForwardAttempts(target, baseParams);

  try {
    // NapCat 与 LLBOT 的转发接口命名不完全一致，这里先试群/私聊专用 action，再回退到通用 forward API。
    await tryOneBotActions(internal, attempts);
    return true;
  } catch (error) {
    logger.warn(
      "meme.list forward send failed, fallback to text: %s",
      String(error),
    );
    return false;
  }
}

export async function sendMemeSearchForwardMessage(
  session: unknown,
  content: string,
  count: number,
  logger: ReturnType<Context["logger"]>,
): Promise<boolean> {
  const oneBotSession = session as OneBotForwardSession | undefined;
  if (oneBotSession?.platform !== "onebot") return false;
  if (!content) return false;

  const internal = oneBotSession.bot?.internal;
  if (!internal) return false;

  const target = resolveOneBotForwardTarget(oneBotSession);
  if (!target) return false;

  const sender = resolveForwardSender(oneBotSession);
  const messages = [
    {
      type: "node",
      data: {
        name: sender.name,
        uin: sender.id,
        content,
      },
    },
  ];
  const metadata = {
    prompt: "表情搜索结果",
    summary: `查看 ${count} 条搜索结果`,
    source: "meme.search",
  };
  const attempts = createOneBotForwardAttempts(target, {
    messages,
    ...metadata,
  });

  try {
    // 搜索结果也沿用 OneBot forward，避免长结果直接撞平台文本长度限制。
    await tryOneBotActions(internal, attempts);
    return true;
  } catch (error) {
    logger.warn(
      "meme.search forward send failed, fallback to text: %s",
      String(error),
    );
    return false;
  }
}

function resolveMemeListCategory(
  params: MemeInfoResponse["params_type"] | undefined,
): MemeListCategory {
  if (!params) return "unknown";

  const needImage = params.max_images > 0;
  const needText = params.max_texts > 0;

  if (!needImage && !needText) return "no-args";
  if (!needImage && needText) return "text-only";
  if (needImage && !needText) return "image-only";
  return "image-and-text";
}

function shouldExcludeByMemeCategory(
  category: MemeListCategory,
  params: MemeInfoResponse["params_type"] | undefined,
  config: Config,
): boolean {
  if (category === "text-only") return config.excludeTextOnlyMemes;
  if (category === "image-only") {
    if (!params) return config.excludeOtherMemes;
    const minImages = params.min_images;
    const maxImages = params.max_images;
    if (maxImages <= 1) return config.excludeSingleImageOnlyMemes;
    if (minImages >= 2) return config.excludeTwoImageOnlyMemes;
    return config.excludeOtherMemes;
  }
  if (category === "image-and-text") return config.excludeImageAndTextMemes;
  return config.excludeOtherMemes;
}

function isParamsTypeExcludedByConfig(
  params: MemeInfoResponse["params_type"] | undefined,
  config: Config,
): boolean {
  return shouldExcludeByMemeCategory(
    resolveMemeListCategory(params),
    params,
    config,
  );
}

export async function buildCategoryExcludedMemeKeySet(
  client: MemeBackendClient,
  keys: string[],
  config: Config,
): Promise<Set<string>> {
  if (keys.length === 0) return new Set<string>();
  if (
    !config.excludeTextOnlyMemes &&
    !config.excludeSingleImageOnlyMemes &&
    !config.excludeTwoImageOnlyMemes &&
    !config.excludeImageAndTextMemes &&
    !config.excludeOtherMemes
  ) {
    return new Set<string>();
  }

  const infoResults = await fetchMemeListInfos(client, keys, config);
  return new Set(
    infoResults
      .filter(
        (result) =>
          result.info &&
          isParamsTypeExcludedByConfig(result.info.params_type, config),
      )
      .map((result) => normalizeMemeKey(result.key)),
  );
}

function pickChineseAlias(info: MemeInfoResponse): string {
  const aliases = [
    ...info.keywords,
    ...info.shortcuts.flatMap((shortcut) =>
      shortcut.humanized ? [shortcut.humanized, shortcut.key] : [shortcut.key],
    ),
  ]
    .map((alias) => alias.trim())
    .filter(Boolean);

  const chineseAlias = aliases.find((alias) => /[^\x00-\x7F]/.test(alias));
  if (chineseAlias) return chineseAlias;
  return info.key;
}

function buildMemeSearchText(info: MemeInfoResponse): string {
  const values = [info.key, ...info.keywords, ...info.tags];
  for (const shortcut of info.shortcuts) {
    values.push(shortcut.humanized || shortcut.key);
  }
  return values.join(" ").toLowerCase();
}

export function searchMemeInfos(
  infoResults: MemeListInfoResult[],
  query: string,
  limit = MEME_SEARCH_RESULT_LIMIT,
): MemeSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const exactMatches: MemeSearchResult[] = [];
  const fuzzyMatches: MemeSearchResult[] = [];

  for (const result of infoResults) {
    if (!result.info) continue;

    const info = result.info;
    const exactCandidates = [info.key, ...info.keywords].map((value) =>
      value.trim().toLowerCase(),
    );
    const searchResult = { alias: pickChineseAlias(info) };

    if (exactCandidates.includes(normalizedQuery)) {
      exactMatches.push(searchResult);
    } else if (buildMemeSearchText(info).includes(normalizedQuery)) {
      fuzzyMatches.push(searchResult);
    }
  }

  return [...exactMatches, ...fuzzyMatches].slice(0, limit);
}

export function formatMemeSearchResultMessage(
  results: MemeSearchResult[],
): string {
  const title = `搜索结果（查看 ${results.length} 条搜索结果）`;
  return [
    title,
    ...results.map((result, index) => `${index + 1}. ${result.alias}`),
  ].join("\n");
}

function resolveMemeListInfoConcurrency(
  config: Config,
  keyCount: number,
): number {
  if (keyCount <= 0) return 0;
  const normalized = Number.isFinite(config.infoFetchConcurrency)
    ? Math.floor(config.infoFetchConcurrency)
    : 0;

  if (normalized <= 0) return keyCount;
  return Math.min(keyCount, Math.max(1, normalized));
}

export async function fetchMemeListInfos(
  client: MemeBackendClient,
  keys: string[],
  config: Config,
): Promise<MemeListInfoResult[]> {
  const results: MemeListInfoResult[] = new Array(keys.length);
  const workerCount = resolveMemeListInfoConcurrency(config, keys.length);
  let nextIndex = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= keys.length) break;

      const key = keys[index];
      try {
        const info = await client.getInfo(key);
        results[index] = { key, info };
      } catch {
        results[index] = { key };
      }
    }
  });

  await Promise.all(workers);
  return results;
}

export function buildMemeListEntries(
  infoResults: MemeListInfoResult[],
  showKey: boolean,
): MemeListEntry[] {
  return infoResults.map((result) => {
    if (!result.info) {
      return {
        alias: result.key,
        category: "unknown",
      };
    }
    const alias = pickChineseAlias(result.info);

    return {
      alias:
        showKey && alias !== result.key ? `${alias}（${result.key}）` : alias,
      category: resolveMemeListCategory(result.info.params_type),
    };
  });
}

export function buildMemeListSections(
  entries: MemeListEntry[],
): MemeListSection[] {
  const sections: MemeListSection[] = [];

  for (const category of MEME_LIST_CATEGORY_ORDER) {
    const aliases = Array.from(
      new Set(
        entries
          .filter((entry) => entry.category === category)
          .map((entry) => entry.alias.trim())
          .filter(Boolean)
          .sort((left, right) =>
            left.localeCompare(right, "zh-Hans-CN", {
              sensitivity: "base",
            }),
          ),
      ),
    );

    if (aliases.length === 0) continue;

    sections.push({
      title: MEME_LIST_CATEGORY_LABEL[category],
      aliases,
    });
  }

  return sections;
}

export function formatMemeListLines(sections: MemeListSection[]): string[] {
  const lines: string[] = [];

  for (const section of sections) {
    lines.push(section.title);
    lines.push(section.aliases.join(" "));
    lines.push("");
  }

  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
}

function toBase64(data: unknown): string | undefined {
  if (Buffer.isBuffer(data)) return data.toString("base64");
  if (data instanceof Uint8Array) return Buffer.from(data).toString("base64");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("base64");
  return undefined;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function stringifyImageSegment(
  image: ReturnType<typeof h.image>,
): string {
  const normalize = (h as { normalize?: (value: unknown) => unknown[] })
    .normalize;
  if (typeof normalize === "function") {
    const normalized = normalize(image)
      .map((value) => String(value))
      .join("");
    if (normalized.trim()) return normalized;
  }

  const text = String(image);
  if (text && text !== "[object Object]") return text;

  const imageLike = image as unknown as {
    attrs?: { src?: unknown; url?: unknown };
    mimeType?: unknown;
    buffer?: unknown;
  };

  const source = imageLike.attrs?.src ?? imageLike.attrs?.url;
  if (typeof source === "string" && source.trim()) {
    return `<img src="${source.trim()}"/>`;
  }

  const base64 = toBase64(imageLike.buffer);
  if (!base64) return "<img/>";

  const mimeType =
    typeof imageLike.mimeType === "string" && imageLike.mimeType.trim()
      ? imageLike.mimeType.trim()
      : "image/png";

  return `<img src="data:${mimeType};base64,${base64}"/>`;
}

export async function buildListMessage(
  ctx: ContextWithOptionalServices,
  sections: MemeListSection[],
  lines: string[],
  renderAsImage: boolean,
  _platform: string | undefined,
  logger: ReturnType<Context["logger"]>,
): Promise<string> {
  const content = lines.join("\n");
  if (!renderAsImage || !ctx.puppeteer) return content;

  const width = 2400;
  const titleFontSize = 22;
  const aliasFontSize = 16;
  const paddingX = 72;
  const paddingY = 72;

  try {
    const sectionContent = sections
      .map((section) => {
        const aliasCells = section.aliases
          .map((alias) => `<div class="alias-cell">${escapeXml(alias)}</div>`)
          .join("");
        return `<section class="section"><div class="section-title">${escapeXml(section.title)}</div><div class="alias-grid">${aliasCells}</div></section>`;
      })
      .join("");

    const fallbackContent = lines
      .map((line) => `<div class="line">${escapeXml(line)}</div>`)
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:0;background:#f5f7fb;}#list{width:${width}px;padding:${paddingY}px ${paddingX}px;box-sizing:border-box;color:#0f172a;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Noto Emoji","Segoe UI Symbol","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Arial Unicode MS",sans-serif;font-variant-emoji:emoji;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;}.section{margin:0 0 22px 0;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#ffffff;}.section-title{padding:12px 16px;background:#e2e8f0;border-bottom:1px solid #cbd5e1;font-size:${titleFontSize}px;line-height:1.4;font-weight:700;}.alias-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));}.alias-cell{padding:10px 12px;font-size:${aliasFontSize}px;line-height:1.5;border-right:1px solid #dbe3ee;border-bottom:1px solid #dbe3ee;word-break:break-word;overflow-wrap:anywhere;background:#ffffff;}.alias-cell:nth-child(2n){background:#f8fafc;}.line{font-size:${aliasFontSize}px;line-height:1.6;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;}.alias-cell img.emoji,.line img.emoji{width:1.15em;height:1.15em;vertical-align:-0.2em;margin:0 0.02em;}</style></head><body><div id="list">${sections.length > 0 ? sectionContent : fallbackContent}</div></body></html>`;

    const renderedSegment = await ctx.puppeteer.render(
      html,
      async (page, next) => {
        await page.evaluate(async () => {
          const loadTwemoji = async (): Promise<boolean> => {
            const twemojiApi = (window as unknown as { twemoji?: unknown })
              .twemoji;
            if (twemojiApi) return true;

            const scriptUrls = [
              "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/dist/twemoji.min.js",
              "https://unpkg.com/twemoji@14.0.2/dist/twemoji.min.js",
            ];

            const loadScript = async (url: string): Promise<boolean> => {
              return await new Promise<boolean>((resolve) => {
                const script = document.createElement("script");
                script.src = url;
                script.async = true;
                script.onload = () => resolve(true);
                script.onerror = () => resolve(false);
                document.head.appendChild(script);
              });
            };

            for (const url of scriptUrls) {
              const loaded = await loadScript(url);
              if (loaded) return true;
            }

            return false;
          };

          if (typeof document !== "undefined" && document.fonts?.ready) {
            await document.fonts.ready;
          }

          const loaded = await loadTwemoji();
          if (!loaded) return;

          const listNode = document.querySelector("#list");
          const twemojiApi = (
            window as unknown as {
              twemoji?: {
                parse: (
                  node: Element,
                  options?: {
                    base?: string;
                    folder?: string;
                    ext?: string;
                    className?: string;
                  },
                ) => void;
              };
            }
          ).twemoji;
          if (!listNode || !twemojiApi) return;

          twemojiApi.parse(listNode, {
            base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
            folder: "svg",
            ext: ".svg",
            className: "emoji",
          });

          const emojiImages = Array.from(
            document.querySelectorAll<HTMLImageElement>("#list img.emoji"),
          );
          if (emojiImages.length === 0) return;

          await Promise.race([
            Promise.all(
              emojiImages.map(
                (image) =>
                  new Promise<void>((resolve) => {
                    if (image.complete) {
                      resolve();
                      return;
                    }
                    image.addEventListener("load", () => resolve(), {
                      once: true,
                    });
                    image.addEventListener("error", () => resolve(), {
                      once: true,
                    });
                  }),
              ),
            ),
            new Promise<void>((resolve) => setTimeout(resolve, 2500)),
          ]);
        });

        const handle = await page.$("#list");
        return next(handle);
      },
    );

    return renderedSegment || content;
  } catch (error) {
    logger.warn(
      "meme.list image render failed, fallback to text: %s",
      String(error),
    );
    return content;
  }
}
