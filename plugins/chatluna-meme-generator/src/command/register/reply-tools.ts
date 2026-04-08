/**
 * 回复工具字段注册
 * 将 meme XML 调用能力注入实验性 character_reply 参数
 */

import type { Context, Session } from "koishi";
import type { Config } from "../../config";
import type {
  CharacterReplyToolField,
  ContextWithChatlunaCharacter,
} from "./types";
import type {
  XmlToolCallInput,
  XmlToolSendPayload,
} from "./xml-runtime";

export interface RegisterReplyToolsDeps {
  ctx: Context;
  config: Config;
  logger: ReturnType<Context["logger"]>;
  executeToolCall: (
    session: Session,
    toolCall: XmlToolCallInput,
  ) => Promise<XmlToolSendPayload | null>;
}

interface ReplyToolActionLike {
  key?: unknown;
  text?: unknown;
  texts?: unknown;
  image?: unknown;
  images?: unknown;
  at?: unknown;
  ats?: unknown;
}

interface CharacterServiceLike {
  registerReplyToolField?: (field: CharacterReplyToolField) => () => void;
}

function escapeXmlAttr(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .trim();
}

function normalizeUniqueStrings(values: unknown): string[] {
  if (Array.isArray(values)) {
    const dedupe = new Set<string>();
    const normalized: string[] = [];
    for (const item of values) {
      const value = String(item ?? "").trim();
      if (!value || dedupe.has(value)) continue;
      dedupe.add(value);
      normalized.push(value);
    }
    return normalized;
  }

  const raw = String(values ?? "").trim();
  if (!raw) return [];
  return normalizeUniqueStrings(raw.split("|"));
}

function normalizeAtUserIds(values: unknown): string[] {
  const dedupe = new Set<string>();
  const normalized: string[] = [];
  for (const value of normalizeUniqueStrings(values)) {
    const userId = value.replace(/^@+/, "").trim();
    if (!userId || dedupe.has(userId)) continue;
    dedupe.add(userId);
    normalized.push(userId);
  }
  return normalized;
}

function parseReplyToolAction(value: unknown): XmlToolCallInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const action = value as ReplyToolActionLike;
  const key = String(action.key ?? "").trim();
  if (!key) return null;

  const texts = normalizeUniqueStrings(action.texts ?? action.text);
  const imageSources = normalizeUniqueStrings(action.images ?? action.image);
  const atUserIds = normalizeAtUserIds(action.ats ?? action.at);

  return {
    key,
    texts,
    imageSources,
    atUserIds,
  };
}

function parseReplyToolActions(value: unknown): XmlToolCallInput[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => parseReplyToolAction(item))
      .filter((item): item is XmlToolCallInput => Boolean(item));
  }

  const parsed = parseReplyToolAction(value);
  return parsed ? [parsed] : [];
}

function renderXmlAction(action: XmlToolCallInput): string {
  const attrs = [`key="${escapeXmlAttr(action.key)}"`];
  if (action.texts.length > 0) {
    attrs.push(`text=\"${escapeXmlAttr(action.texts.join("|"))}\"`);
  }
  if (action.imageSources.length > 0) {
    attrs.push(`image=\"${escapeXmlAttr(action.imageSources.join("|"))}\"`);
  }
  if (action.atUserIds.length > 0) {
    attrs.push(`at=\"${escapeXmlAttr(action.atUserIds.join("|"))}\"`);
  }
  return `<meme ${attrs.join(" ")} />`;
}

export function hasReplyToolsEnabled(config: Config): boolean {
  return Boolean(config.enableMemeXmlTool && config.injectMemeXmlToolAsReplyTool);
}

export function registerCharacterReplyTools(
  deps: RegisterReplyToolsDeps,
): () => void {
  const { ctx, config, logger, executeToolCall } = deps;
  const service = (ctx as ContextWithChatlunaCharacter)
    .chatluna_character as CharacterServiceLike | undefined;
  if (!service?.registerReplyToolField) return () => {};

  const disposer = service.registerReplyToolField({
    name: "meme_generate",
    schema: {
      type: "array",
      description:
        "Generate meme images after this reply. Each item represents one meme action.",
      items: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "Meme key to generate.",
          },
          text: {
            oneOf: [
              {
                type: "string",
                description: "Text input. Use | to separate multiple texts.",
              },
              {
                type: "array",
                description: "Text inputs.",
                items: { type: "string" },
              },
            ],
          },
          image: {
            oneOf: [
              {
                type: "string",
                description: "Image URL input. Use | to separate multiple images.",
              },
              {
                type: "array",
                description: "Image URL inputs.",
                items: { type: "string" },
              },
            ],
          },
          at: {
            oneOf: [
              {
                type: "string",
                description: "Mentioned user IDs. Use | to separate multiple IDs.",
              },
              {
                type: "array",
                description: "Mentioned user IDs.",
                items: { type: "string" },
              },
            ],
          },
        },
        required: ["key"],
      },
    },
    isAvailable(_, __) {
      return hasReplyToolsEnabled(config);
    },
    async invoke(_, session, value) {
      const actions = parseReplyToolActions(value);
      for (const action of actions) {
        const payload = await executeToolCall(session, action);
        if (!payload) continue;
        await session.send(payload.result);
        logger.info(
          "meme=%s, user=%s, guild=%s",
          payload.memeKey,
          session.userId,
          session.guildId,
        );
      }
    },
    render(_, __, value) {
      const actions = parseReplyToolActions(value);
      if (actions.length === 0) return;
      return actions.map((action) => renderXmlAction(action));
    },
  });

  return () => {
    disposer();
  };
}
