/**
 * 命令注册与执行链路
 * 注册 meme 相关命令并完成生成请求调用
 */

import { h, type Context, type Session } from "koishi";
import type { Config } from "../config";
import { applyAutoFillPolicy } from "../domain/policy";
import { MemeBackendClient } from "../infra/client";
import { mapBackendStatus, mapNetworkError } from "../infra/errors";
import { parseCommandInput } from "./parse";
import {
  getBotAvatarImage,
  getMentionedSecondaryAvatarImage,
  getMentionedTargetAvatarImage,
  getMentionedTargetDisplayName,
  getSenderAvatarImage,
  getSenderDisplayName,
} from "../utils/avatar";
import {
  createShuffledKeys,
  getRandomCandidatesWithDedupe,
  pickRandomItem,
  recordRandomSelection,
} from "./random";
import {
  createMemeKeyResolver,
  listDirectAliases,
  shouldRegisterDirectAlias,
} from "./key-resolver";

interface HttpLikeError {
  response?: {
    status?: number;
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

interface FrontendNotifier {
  update(payload: { type: "success"; content: string }): void;
}

type ContextWithOptionalNotifier = Context & {
  notifier?: {
    create(): FrontendNotifier;
  };
};

function asHttpError(error: unknown): HttpLikeError {
  if (typeof error !== "object" || error === null) {
    return { message: String(error) };
  }

  return error as HttpLikeError;
}

function mapRuntimeErrorMessage(error: unknown): string {
  const httpError = asHttpError(error);
  if (httpError.response?.status) {
    return mapBackendStatus(
      httpError.response.status,
      httpError.response.data?.detail,
    );
  }
  return mapNetworkError(error);
}

function buildRandomConfig(config: Config): Config {
  return {
    ...config,
    autoUseAvatarWhenMinImagesOneAndNoImage: true,
    autoFillOneMissingImageWithAvatar: true,
    autoFillSenderAndBotAvatarsWhenMinImagesTwoAndNoImage: true,
  };
}

type PreparedImages = Awaited<ReturnType<typeof parseCommandInput>>["images"];
type PreparedAvatarImage = Awaited<ReturnType<typeof getSenderAvatarImage>>;

interface ElementLike {
  type?: string;
  attrs?: {
    id?: unknown;
    name?: unknown;
    userId?: unknown;
    qq?: unknown;
  };
  children?: ElementLike[];
}

function collectMentionTokens(session: Session): string[] {
  const mentionTokens: string[] = [];

  const appendMentionToken = (value: unknown): void => {
    if (typeof value !== "string" && typeof value !== "number") return;
    const normalizedValue = String(value).trim();
    if (!normalizedValue) return;
    mentionTokens.push(`@${normalizedValue}`);
  };

  const walk = (elements: readonly ElementLike[]): void => {
    for (const element of elements) {
      if (element.type === "at") {
        appendMentionToken(element.attrs?.id);
        appendMentionToken(element.attrs?.name);
        appendMentionToken(element.attrs?.userId);
        appendMentionToken(element.attrs?.qq);
      }
      if (element.children?.length) walk(element.children);
    }
  };

  if (Array.isArray(session.elements)) {
    walk(session.elements as ElementLike[]);
  }

  return mentionTokens.sort((left, right) => right.length - left.length);
}

function removeFirstOccurrence(source: string, target: string): string {
  const index = source.indexOf(target);
  if (index < 0) return source;
  return `${source.slice(0, index)} ${source.slice(index + target.length)}`;
}

function normalizeDirectAliasRestText(
  rest: string,
  session: Session,
): string[] {
  let normalizedRest = rest
    .replace(/^\s+/, "")
    .replace(/<at\b[^>]*>(?:<\/at>)?/gi, " ");

  for (const mentionToken of collectMentionTokens(session)) {
    normalizedRest = removeFirstOccurrence(normalizedRest, mentionToken);
  }

  normalizedRest = normalizedRest.trim();
  if (!normalizedRest) return [];

  return normalizedRest
    .split(/\s+/)
    .map((text) => text.trim())
    .filter(Boolean);
}

function extractDirectAliasTexts(
  session: Session,
  alias: string,
  allowMergedSuffix: boolean,
): string[] | undefined {
  const strippedContent = session.stripped?.content;
  if (typeof strippedContent !== "string") return undefined;

  const content = strippedContent.trim();
  if (!content.startsWith(alias)) return undefined;

  const rest = content.slice(alias.length);
  if (!rest) return [];
  if (!allowMergedSuffix && !/^\s/.test(rest)) return undefined;

  return normalizeDirectAliasRestText(rest, session);
}

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createStrictDirectAliasPattern(alias: string): RegExp {
  return new RegExp(`^${escapeRegExp(alias)}(?:\\s+[\\s\\S]*)?$`);
}

function createMergedDirectAliasPattern(alias: string): RegExp {
  return new RegExp(`^${escapeRegExp(alias)}[\\s\\S]*$`);
}

function resolveFirstDirectAlias(
  keywords: string[],
  shortcuts: Array<{ key: string; humanized?: string }>,
): string | undefined {
  const aliases = [
    ...keywords,
    ...shortcuts.flatMap((shortcut) =>
      shortcut.humanized ? [shortcut.key, shortcut.humanized] : [shortcut.key],
    ),
  ]
    .map((alias) => alias.trim())
    .filter(Boolean)
    .filter((alias) => shouldRegisterDirectAlias(alias));

  const preferredAlias = aliases.find(
    (alias) => /[^\x00-\x7F]/.test(alias) && alias.length >= 2,
  );
  return preferredAlias;
}

function buildRandomTriggerText(
  directAlias: string | undefined,
  key: string,
  texts: string[],
  session: Session,
): string {
  const triggerHead = directAlias || `meme ${key}`;
  const mentionTexts = collectMentionTokens(session);
  const suffixTexts = [...mentionTexts, ...texts.map((text) => text.trim())]
    .filter(Boolean)
    .join(" ");

  return suffixTexts ? `${triggerHead} ${suffixTexts}` : triggerHead;
}

function toBase64(data: unknown): string | undefined {
  if (Buffer.isBuffer(data)) return data.toString("base64");
  if (data instanceof Uint8Array) return Buffer.from(data).toString("base64");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("base64");
  return undefined;
}

function stringifyImageSegment(image: ReturnType<typeof h.image>): string {
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildListMessage(keys: string[], renderAsImage: boolean): string {
  const content = keys.join("\n");
  if (!renderAsImage) return content;

  const lines = content.split("\n");
  const fontSize = 20;
  const lineHeight = 30;
  const width = 1280;
  const paddingX = 40;
  const paddingY = 40;
  const height = Math.max(200, paddingY * 2 + lines.length * lineHeight);

  const textNodes = lines
    .map((line, index) => {
      const y = paddingY + (index + 1) * lineHeight;
      return `<text x="${paddingX}" y="${y}">${escapeXml(line)}</text>`;
    })
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#111827"/><g fill="#f9fafb" font-size="${fontSize}" font-family="Menlo, Monaco, Consolas, monospace">${textNodes}</g></svg>`;
  const svgBase64 = Buffer.from(svg).toString("base64");
  return `<img src="data:image/svg+xml;base64,${svgBase64}"/>`;
}

export function registerCommands(ctx: Context, config: Config): void {
  const client = new MemeBackendClient(
    ctx,
    config.baseUrl.replace(/\/$/, ""),
    config.timeoutMs,
  );
  const resolveMemeKey = createMemeKeyResolver(client, {
    enableInfoFetchConcurrencyLimit: config.enableInfoFetchConcurrencyLimit,
    infoFetchConcurrency: config.infoFetchConcurrency,
  });
  const logger = ctx.logger("chatluna-meme-generator");

  const handleErrorReply = (scope: string, message: string): string => {
    if (!config.disableErrorReplyToPlatform) return message;
    logger.warn("%s failed: %s", scope, message);
    return "";
  };

  const handleRuntimeError = (scope: string, error: unknown): string => {
    return handleErrorReply(scope, mapRuntimeErrorMessage(error));
  };

  const executePreview = async (
    key: string,
  ): Promise<string | ReturnType<typeof h.image>> => {
    if (!key) return handleErrorReply("meme.preview", "请提供模板 key。");

    try {
      const resolvedKey = await resolveMemeKey(key);
      const preview = await client.getPreview(resolvedKey);
      return h.image(Buffer.from(preview.buffer), preview.mimeType);
    } catch (error) {
      return handleRuntimeError("meme.preview", error);
    }
  };

  ctx.command("meme.list", "列出可用 meme 模板").action(async () => {
    try {
      const keys = await client.getKeys();
      if (keys.length === 0) return "当前后端没有可用模板。";
      return buildListMessage(keys, config.renderMemeListAsImage);
    } catch (error) {
      return handleRuntimeError("meme.list", error);
    }
  });

  ctx
    .command("meme.info <key:string>", "查看模板参数约束")
    .action(async (_, key) => {
      if (!key) return handleErrorReply("meme.info", "请提供模板 key。");
      try {
        const resolvedKey = await resolveMemeKey(key);
        const info = await client.getInfo(resolvedKey);
        const params = info.params_type;
        return [
          `key: ${info.key}`,
          `images: ${params.min_images} ~ ${params.max_images}`,
          `texts: ${params.min_texts} ~ ${params.max_texts}`,
          `default_texts: ${params.default_texts.join(" | ") || "(空)"}`,
        ].join("\n");
      } catch (error) {
        return handleRuntimeError("meme.info", error);
      }
    });

  ctx
    .command("meme.preview <key:string>", "预览模板效果")
    .action(async (_, key) => executePreview(key));

  const aliasLogger = logger;
  let initializedNotified = false;
  const notifier = (ctx as ContextWithOptionalNotifier).notifier?.create();

  const notifyInitializedSummary = (count: number): void => {
    if (initializedNotified) return;
    initializedNotified = true;
    notifier?.update({
      type: "success",
      content: `插件初始化完毕，共载入 ${count} 个表情。`,
    });
  };

  let randomSelectionHistory = new Map<string, number>();
  let randomSelectionQueue: Promise<void> = Promise.resolve();

  const withRandomSelectionLock = async <T>(
    task: () => Promise<T>,
  ): Promise<T> => {
    const previous = randomSelectionQueue;
    let releaseLock: (() => void) | undefined;
    randomSelectionQueue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await previous;
    try {
      return await task();
    } finally {
      releaseLock?.();
    }
  };

  if (config.enableDirectAliasWithoutPrefix) {
    const directAliasMatchDisposers = new Map<string, () => void>();
    const registeredAliasKeySignatures = new Map<string, string>();
    const duplicatedAliasSignatures = new Map<string, string>();
    let aliasRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let aliasRetryAttempts = 0;
    let aliasRetryRunning = false;
    let aliasRetryDisposed = false;

    const maxAliasRetryAttempts = config.initLoadRetryTimes;

    const registerDirectAliases = async (): Promise<boolean> => {
      if (aliasRetryDisposed) return true;
      const result = await listDirectAliases(client, {
        enableInfoFetchConcurrencyLimit: config.enableInfoFetchConcurrencyLimit,
        infoFetchConcurrency: config.infoFetchConcurrency,
      });
      if (aliasRetryDisposed) return true;
      notifyInitializedSummary(result.totalKeys);
      let registeredCount = 0;
      let updatedCount = 0;
      let removedCount = 0;

      const sortedEntries = [...result.entries].sort(
        (left, right) => right.alias.length - left.alias.length,
      );
      const activeAliases = new Set<string>();

      const duplicatedAliasEntries = sortedEntries.filter(
        (entry) => entry.keys.length > 1,
      );
      const duplicatedAliasSet = new Set(
        duplicatedAliasEntries.map((entry) => entry.alias),
      );
      for (const existingAlias of duplicatedAliasSignatures.keys()) {
        if (!duplicatedAliasSet.has(existingAlias)) {
          duplicatedAliasSignatures.delete(existingAlias);
        }
      }
      for (const duplicatedEntry of duplicatedAliasEntries) {
        const duplicatedSignature = duplicatedEntry.keys.join("\u0000");
        if (
          duplicatedAliasSignatures.get(duplicatedEntry.alias) ===
          duplicatedSignature
        ) {
          continue;
        }

        duplicatedAliasSignatures.set(
          duplicatedEntry.alias,
          duplicatedSignature,
        );
        aliasLogger.warn(
          "detected duplicate direct alias: %s -> %s",
          duplicatedEntry.alias,
          duplicatedEntry.keys.join(", "),
        );
      }

      for (const entry of sortedEntries) {
        if (!shouldRegisterDirectAlias(entry.alias)) continue;
        if (ctx.$commander.get(entry.alias)) continue;

        const aliasKeys = entry.keys.filter(Boolean);
        if (aliasKeys.length === 0) continue;
        activeAliases.add(entry.alias);

        const aliasKeySignature = aliasKeys.join("\u0000");
        const registeredSignature = registeredAliasKeySignatures.get(
          entry.alias,
        );
        if (registeredSignature === aliasKeySignature) continue;

        const previousDispose = directAliasMatchDisposers.get(entry.alias);
        if (previousDispose) {
          previousDispose();
          updatedCount += 1;
        } else {
          registeredCount += 1;
        }

        const directAliasPattern = config.allowMentionPrefixDirectAliasTrigger
          ? createMergedDirectAliasPattern(entry.alias)
          : createStrictDirectAliasPattern(entry.alias);

        const disposeMatch = ctx.$processor.match(
          directAliasPattern,
          async (session) => {
            const directAliasTexts = extractDirectAliasTexts(
              session,
              entry.alias,
              config.allowMentionPrefixDirectAliasTrigger,
            );
            if (!directAliasTexts) return "";

            const pickedKey =
              aliasKeys.length === 1
                ? aliasKeys[0]
                : aliasKeys[Math.floor(Math.random() * aliasKeys.length)];

            return (
              (await handleGenerate(
                ctx,
                session,
                client,
                config,
                pickedKey,
                directAliasTexts,
              )) ?? ""
            );
          },
          {
            appel: false,
            i18n: false,
            fuzzy: false,
          },
        );

        directAliasMatchDisposers.set(entry.alias, disposeMatch);
        registeredAliasKeySignatures.set(entry.alias, aliasKeySignature);
      }

      for (const [alias, disposeMatch] of directAliasMatchDisposers.entries()) {
        if (activeAliases.has(alias)) continue;
        disposeMatch();
        directAliasMatchDisposers.delete(alias);
        registeredAliasKeySignatures.delete(alias);
        duplicatedAliasSignatures.delete(alias);
        removedCount += 1;
      }

      aliasLogger.info(
        "registered direct aliases: %d (new: %d, updated: %d, removed: %d, duplicated aliases: %d, failed info keys: %d/%d)",
        directAliasMatchDisposers.size,
        registeredCount,
        updatedCount,
        removedCount,
        duplicatedAliasEntries.length,
        result.failedInfoKeys,
        result.totalKeys,
      );

      return !result.hasInfoFailure;
    };

    const clearAliasRetryTimer = (): void => {
      if (aliasRetryTimer) {
        clearTimeout(aliasRetryTimer);
        aliasRetryTimer = undefined;
      }
    };

    const stopAliasRetry = (): void => {
      clearAliasRetryTimer();
      aliasRetryRunning = false;
    };

    const scheduleAliasRetry = (delayMs: number): void => {
      if (aliasRetryDisposed) return;
      if (aliasRetryRunning && aliasRetryTimer) return;
      if (aliasRetryAttempts >= maxAliasRetryAttempts) {
        aliasLogger.warn(
          "direct alias retry stopped after %d attempts",
          aliasRetryAttempts,
        );
        stopAliasRetry();
        return;
      }

      aliasRetryRunning = true;
      aliasRetryTimer = setTimeout(() => {
        if (aliasRetryDisposed) {
          aliasRetryTimer = undefined;
          return;
        }
        aliasRetryTimer = undefined;
        aliasRetryAttempts += 1;

        void registerDirectAliases()
          .then((isComplete) => {
            if (aliasRetryDisposed) {
              stopAliasRetry();
              return;
            }
            if (isComplete) {
              aliasRetryAttempts = 0;
              stopAliasRetry();
              return;
            }

            aliasLogger.warn(
              "direct alias list still incomplete (attempt %d/%d), scheduling retry",
              aliasRetryAttempts,
              maxAliasRetryAttempts,
            );
            scheduleAliasRetry(3000);
          })
          .catch((retryError) => {
            if (aliasRetryDisposed) {
              stopAliasRetry();
              return;
            }
            aliasLogger.warn(
              "failed to register direct aliases on retry (attempt %d/%d): %s",
              aliasRetryAttempts,
              maxAliasRetryAttempts,
              String(retryError),
            );
            scheduleAliasRetry(3000);
          });
      }, delayMs);
    };

    ctx.on("ready", () => {
      aliasRetryDisposed = false;
      aliasRetryAttempts = 0;
      stopAliasRetry();

      void registerDirectAliases()
        .then((isComplete) => {
          if (!isComplete) {
            aliasLogger.warn(
              "direct alias list is incomplete at startup, scheduling retry",
            );
            scheduleAliasRetry(3000);
          }
        })
        .catch((error) => {
          aliasLogger.warn(
            "failed to register direct aliases at startup: %s",
            String(error),
          );
          scheduleAliasRetry(3000);
        });
    });

    ctx.on("dispose", () => {
      aliasRetryDisposed = true;
      stopAliasRetry();
      for (const disposeMatch of directAliasMatchDisposers.values()) {
        disposeMatch();
      }
      directAliasMatchDisposers.clear();
      registeredAliasKeySignatures.clear();
      duplicatedAliasSignatures.clear();
    });
  } else {
    let initRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let initRetryAttempts = 0;
    let initRetryDisposed = false;
    const maxInitRetryAttempts = config.initLoadRetryTimes;

    const clearInitRetryTimer = (): void => {
      if (initRetryTimer) {
        clearTimeout(initRetryTimer);
        initRetryTimer = undefined;
      }
    };

    const stopInitRetry = (): void => {
      clearInitRetryTimer();
    };

    const scheduleInitRetry = (delayMs: number): void => {
      if (initRetryDisposed) return;
      if (initRetryTimer) return;
      if (initRetryAttempts >= maxInitRetryAttempts) {
        aliasLogger.warn(
          "初始化时获取表情列表重试在 %d 次后停止",
          initRetryAttempts,
        );
        stopInitRetry();
        return;
      }

      initRetryTimer = setTimeout(() => {
        if (initRetryDisposed) {
          initRetryTimer = undefined;
          return;
        }
        initRetryTimer = undefined;
        initRetryAttempts += 1;

        void client
          .getKeys()
          .then((keys) => {
            if (initRetryDisposed) {
              stopInitRetry();
              return;
            }
            notifyInitializedSummary(keys.length);
            initRetryAttempts = 0;
            stopInitRetry();
          })
          .catch((retryError) => {
            if (initRetryDisposed) {
              stopInitRetry();
              return;
            }
            aliasLogger.warn(
              "初始化时获取表情列表失败（attempt %d/%d）: %s",
              initRetryAttempts,
              maxInitRetryAttempts,
              String(retryError),
            );
            scheduleInitRetry(3000);
          });
      }, delayMs);
    };

    ctx.on("ready", () => {
      initRetryDisposed = false;
      initRetryAttempts = 0;
      stopInitRetry();

      void client
        .getKeys()
        .then((keys) => {
          if (initRetryDisposed) {
            stopInitRetry();
            return;
          }
          notifyInitializedSummary(keys.length);
        })
        .catch((error) => {
          if (initRetryDisposed) {
            stopInitRetry();
            return;
          }
          aliasLogger.warn("初始化时获取表情列表失败: %s", String(error));
          scheduleInitRetry(3000);
        });
    });

    ctx.on("dispose", () => {
      initRetryDisposed = true;
      stopInitRetry();
    });
  }

  ctx
    .command("meme <key:string> [...texts]", "生成 meme 图片")
    .action(async ({ session }, key, ...texts) => {
      if (!session)
        return handleErrorReply("meme.generate", "当前上下文不可用。");
      if (!key) return handleErrorReply("meme.generate", "请提供模板 key。");

      try {
        const resolvedKey = await resolveMemeKey(key);
        return await handleGenerate(
          ctx,
          session,
          client,
          config,
          resolvedKey,
          texts,
        );
      } catch (error) {
        return handleRuntimeError("meme.generate", error);
      }
    });

  ctx
    .command("meme.random [...texts]", "随机选择模板并生成 meme 图片")
    .action(async ({ session }, ...texts) => {
      if (!session)
        return handleErrorReply("meme.random", "当前上下文不可用。");

      try {
        const executeRandom = async () => {
          const shuffledKeys = createShuffledKeys(await client.getKeys());
          if (shuffledKeys.length === 0) return "当前后端没有可用模板。";

          const parsedInput = await parseCommandInput(
            ctx,
            session,
            texts,
            config,
          );
          const senderName = getSenderDisplayName(session);
          const groupNicknameEnabled =
            config.autoUseGroupNicknameWhenNoDefaultText;
          const targetDisplayName = groupNicknameEnabled
            ? await getMentionedTargetDisplayName(session)
            : undefined;
          const groupNicknameText = groupNicknameEnabled
            ? targetDisplayName || senderName
            : undefined;
          const senderAvatarImage = await getSenderAvatarImage(
            ctx,
            session,
            config.timeoutMs,
          );
          const targetAvatarImage = await getMentionedTargetAvatarImage(
            ctx,
            session,
            config.timeoutMs,
          );
          const secondaryTargetAvatarImage =
            await getMentionedSecondaryAvatarImage(
              ctx,
              session,
              config.timeoutMs,
            );
          const botAvatarImage = await getBotAvatarImage(
            ctx,
            session,
            config.timeoutMs,
          );
          const randomConfig = buildRandomConfig(config);
          const randomDedupeConfig = {
            enabled: config.enableRandomDedupeWithinHours,
            windowHours: config.randomDedupeWindowHours,
          };
          const eligibleCandidates: Array<{
            key: string;
            selectedTextSource?: "template-default" | "user-nickname";
            directAlias?: string;
          }> = [];
          let infoFailedCount = 0;

          for (const key of shuffledKeys) {
            try {
              const info = await client.getInfo(key);
              const finalInput = applyAutoFillPolicy({
                texts: parsedInput.texts,
                images: parsedInput.images,
                params: info.params_type,
                config: randomConfig,
                senderAvatarImage,
                targetAvatarImage,
                secondaryTargetAvatarImage,
                botAvatarImage,
                senderName,
                groupNicknameText,
              });

              const imageCount = finalInput.images.length;
              const textCount = finalInput.texts.length;
              const imageMatch =
                imageCount >= info.params_type.min_images &&
                imageCount <= info.params_type.max_images;
              const textMatch =
                textCount >= info.params_type.min_texts &&
                textCount <= info.params_type.max_texts;
              if (imageMatch && textMatch) {
                eligibleCandidates.push({
                  key,
                  selectedTextSource:
                    finalInput.selectedTextSource === "group-nickname"
                      ? undefined
                      : finalInput.selectedTextSource,
                  directAlias: resolveFirstDirectAlias(
                    info.keywords,
                    info.shortcuts,
                  ),
                });
              }
            } catch (error) {
              infoFailedCount += 1;
              ctx
                .logger("chatluna-meme-generator")
                .warn("meme.random skip key %s: %s", key, String(error));
            }
          }

          const dedupeResult = getRandomCandidatesWithDedupe(
            eligibleCandidates,
            randomSelectionHistory,
            randomDedupeConfig,
          );

          let historyForRecord = dedupeResult.history;
          let candidatesForPick = dedupeResult.candidates;
          if (
            randomDedupeConfig.enabled &&
            eligibleCandidates.length > 0 &&
            candidatesForPick.length === 0
          ) {
            historyForRecord = new Map<string, number>();
            candidatesForPick = eligibleCandidates;
          }

          const randomCandidate = pickRandomItem(candidatesForPick);
          if (!randomCandidate) {
            if (infoFailedCount === shuffledKeys.length) {
              return handleErrorReply(
                "meme.random",
                "随机筛选失败：后端不可用或超时，请稍后重试。",
              );
            }
            return "未找到符合当前输入条件的随机模板，请补充图片或文字后重试。";
          }

          try {
            const result = await handleGenerateWithPreparedInput(
              client,
              randomConfig,
              randomCandidate.key,
              parsedInput.texts,
              parsedInput.images,
              senderAvatarImage,
              targetAvatarImage,
              secondaryTargetAvatarImage,
              botAvatarImage,
              senderName,
              groupNicknameText,
              randomCandidate.selectedTextSource,
            );

            randomSelectionHistory = recordRandomSelection(
              historyForRecord,
              randomCandidate.key,
              randomDedupeConfig,
            );

            if (config.enableRandomKeywordNotice) {
              const randomTriggerText = buildRandomTriggerText(
                randomCandidate.directAlias,
                randomCandidate.key,
                parsedInput.texts,
                session,
              );
              return `${randomTriggerText}\n${stringifyImageSegment(result)}`;
            }

            ctx
              .logger("chatluna-meme-generator")
              .info("meme.random selected key: %s", randomCandidate.key);
            return result;
          } catch (error) {
            const runtimeMessage = mapRuntimeErrorMessage(error);
            if (config.disableErrorReplyToPlatform) {
              logger.warn("meme.random failed: %s", runtimeMessage);
              return "";
            }
            return [`random key: ${randomCandidate.key}`, runtimeMessage].join(
              "\n",
            );
          }
        };

        if (!config.enableRandomDedupeWithinHours) {
          return await executeRandom();
        }

        return await withRandomSelectionLock(executeRandom);
      } catch (error) {
        return handleRuntimeError("meme.random", error);
      }
    });
}

async function handleGenerate(
  ctx: Context,
  session: Session,
  client: MemeBackendClient,
  config: Config,
  key: string,
  texts: string[],
): Promise<string | ReturnType<typeof h.image>> {
  try {
    const parsedInput = await parseCommandInput(ctx, session, texts, config);
    const senderName = getSenderDisplayName(session);
    const groupNicknameEnabled = config.autoUseGroupNicknameWhenNoDefaultText;
    const targetDisplayName = groupNicknameEnabled
      ? await getMentionedTargetDisplayName(session)
      : undefined;
    const groupNicknameText = groupNicknameEnabled
      ? targetDisplayName || senderName
      : undefined;
    const senderAvatarImage = await getSenderAvatarImage(
      ctx,
      session,
      config.timeoutMs,
    );
    const targetAvatarImage = await getMentionedTargetAvatarImage(
      ctx,
      session,
      config.timeoutMs,
    );
    const secondaryTargetAvatarImage = await getMentionedSecondaryAvatarImage(
      ctx,
      session,
      config.timeoutMs,
    );
    const botAvatarImage = await getBotAvatarImage(
      ctx,
      session,
      config.timeoutMs,
    );
    return await handleGenerateWithPreparedInput(
      client,
      config,
      key,
      parsedInput.texts,
      parsedInput.images,
      senderAvatarImage,
      targetAvatarImage,
      secondaryTargetAvatarImage,
      botAvatarImage,
      senderName,
      groupNicknameText,
    );
  } catch (error) {
    const runtimeMessage = mapRuntimeErrorMessage(error);
    if (config.disableErrorReplyToPlatform) {
      ctx
        .logger("chatluna-meme-generator")
        .warn("meme.generate failed: %s", runtimeMessage);
      return "";
    }
    return runtimeMessage;
  }
}

async function handleGenerateWithPreparedInput(
  client: MemeBackendClient,
  config: Config,
  key: string,
  texts: string[],
  images: PreparedImages,
  senderAvatarImage?: PreparedAvatarImage,
  targetAvatarImage?: PreparedAvatarImage,
  secondaryTargetAvatarImage?: PreparedAvatarImage,
  botAvatarImage?: PreparedAvatarImage,
  senderName?: string,
  groupNicknameText?: string,
  preferredTextSource?: "template-default" | "user-nickname",
): Promise<ReturnType<typeof h.image>> {
  const info = await client.getInfo(key);
  const finalInput = applyAutoFillPolicy({
    texts,
    images,
    params: info.params_type,
    config,
    senderAvatarImage,
    targetAvatarImage,
    secondaryTargetAvatarImage,
    botAvatarImage,
    senderName,
    groupNicknameText,
    preferredTextSource,
  });

  const result = await client.generate(
    key,
    finalInput.images,
    finalInput.texts,
    {},
  );
  return h.image(Buffer.from(result.buffer), result.mimeType);
}
