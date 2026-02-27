/**
 * random 与 poke 运行时
 * 负责随机模板筛选、去重与 poke 触发逻辑
 */

import { h, type Context, type Session } from "koishi";
import type { Config } from "../../config";
import { applyAutoFillPolicy } from "../../domain/policy";
import { MemeBackendClient } from "../../infra/client";
import { parseCommandInput } from "../parse";
import {
  createShuffledKeys,
  getRandomCandidatesWithDedupe,
  pickRandomItem,
  recordRandomSelection,
} from "../random";
import {
  getBotAvatarImage,
  getMentionedSecondaryAvatarImage,
  getMentionedTargetAvatarImage,
  getMentionedTargetDisplayName,
  getSenderAvatarImage,
  getSenderDisplayName,
  resolveAvatarImageByUserId,
  resolveDisplayNameByUserId,
} from "../../utils/avatar";
import { buildRandomConfig, type PreparedAvatarImage } from "./generate";
import { mapRuntimeErrorMessage, replyOrSilent } from "./errors";
import { stringifyImageSegment } from "./meme-list";
import type { OneBotLikeInternalEvent } from "./types";
import { resolveFirstDirectAlias } from "./direct-alias-runtime";

function isPokeTargetingCurrentBot(session: Session): boolean {
  const sessionLike = session as unknown as { onebot?: unknown };
  const onebotPayload = sessionLike.onebot;
  if (!onebotPayload || typeof onebotPayload !== "object") return false;

  const eventData = onebotPayload as OneBotLikeInternalEvent;
  const postType =
    typeof eventData.post_type === "string"
      ? eventData.post_type.toLowerCase()
      : "";
  const noticeType =
    typeof eventData.notice_type === "string"
      ? eventData.notice_type.toLowerCase()
      : "";
  const subType =
    typeof eventData.sub_type === "string"
      ? eventData.sub_type.toLowerCase()
      : "";

  if (
    !(postType === "notice" && noticeType === "notify" && subType === "poke")
  ) {
    return false;
  }

  const targetId =
    eventData.target_id == null ? "" : String(eventData.target_id).trim();
  const selfId =
    eventData.self_id == null
      ? (session.selfId ?? "")
      : String(eventData.self_id).trim();

  return targetId.length > 0 && selfId.length > 0 && targetId === selfId;
}

function isPokeTriggerSession(session: Session): boolean {
  if (isPokeTargetingCurrentBot(session)) return true;
  const type = session.type?.toLowerCase() || "";
  const subtype = session.subtype?.toLowerCase() || "";
  return type === "notice" && subtype === "poke";
}

function resolvePokeOperatorId(session: Session): string | undefined {
  const onebotPayload = (session as unknown as { onebot?: unknown }).onebot;
  if (!onebotPayload || typeof onebotPayload !== "object") return undefined;
  const eventData = onebotPayload as OneBotLikeInternalEvent;
  const rawOperator = eventData.operator_id ?? eventData.user_id;
  if (rawOperator == null) return undefined;
  const operatorId = String(rawOperator).trim();
  return operatorId || undefined;
}

function resolvePokeGuildId(session: Session): string | undefined {
  const onebotPayload = (session as unknown as { onebot?: unknown }).onebot;
  if (!onebotPayload || typeof onebotPayload !== "object")
    return session.guildId;
  const eventData = onebotPayload as OneBotLikeInternalEvent;
  const rawGuildId = eventData.group_id;
  if (rawGuildId == null) return session.guildId;
  const guildId = String(rawGuildId).trim();
  return guildId || session.guildId;
}

function normalizePokeDisplayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized;
}

function isPureNumericId(value: string): boolean {
  return /^\d{5,}$/.test(value);
}

function resolvePokeRuntimeSenderFallback(
  session: Session,
): string | undefined {
  const onebotPayload = (session as unknown as { onebot?: unknown }).onebot;
  if (!onebotPayload || typeof onebotPayload !== "object") return undefined;

  const eventData = onebotPayload as Record<string, unknown>;
  const sender =
    (eventData.sender as Record<string, unknown> | undefined) ?? undefined;

  const card = normalizePokeDisplayName(sender?.card ?? eventData.card);
  if (card) return card;

  const nickname = normalizePokeDisplayName(
    sender?.nickname ?? eventData.nickname,
  );
  if (nickname) return nickname;

  const title = normalizePokeDisplayName(sender?.title ?? eventData.title);
  if (title) return title;

  return undefined;
}

function sanitizeResolvedPokeDisplayName(
  name: string | undefined,
  actorUserId?: string,
): string | undefined {
  const normalizedName = normalizePokeDisplayName(name);
  if (!normalizedName) return undefined;
  if (actorUserId && normalizedName === actorUserId) return undefined;
  if (isPureNumericId(normalizedName) && !actorUserId) return undefined;
  if (isPureNumericId(normalizedName) && normalizedName === actorUserId) {
    return undefined;
  }
  return normalizedName;
}

async function resolvePokeRuntimeHints(session: Session): Promise<{
  senderName?: string;
  groupNicknameText?: string;
  actorUserId?: string;
  preferredGuildId?: string;
}> {
  const senderFallbackName = resolvePokeRuntimeSenderFallback(session);
  const senderName = senderFallbackName || getSenderDisplayName(session);
  if (!isPokeTriggerSession(session)) {
    return { senderName };
  }

  const operatorId = resolvePokeOperatorId(session);
  const fallbackUserId = session.userId?.trim();
  const actorUserId = operatorId || fallbackUserId;
  if (!actorUserId) {
    return { senderName };
  }

  const resolvedGuildId = resolvePokeGuildId(session);
  const preferredGuildId =
    resolvedGuildId && resolvedGuildId !== "private"
      ? resolvedGuildId
      : undefined;

  const operatorDisplayName = sanitizeResolvedPokeDisplayName(
    await resolveDisplayNameByUserId(session, actorUserId, preferredGuildId),
    actorUserId,
  );

  return {
    senderName: operatorDisplayName || senderName,
    groupNicknameText: operatorDisplayName || senderFallbackName || senderName,
    actorUserId,
    preferredGuildId,
  };
}

async function resolvePokeAvatarHints(
  ctx: Context,
  session: Session,
  timeoutMs: number,
): Promise<{
  senderAvatarImage?: PreparedAvatarImage;
  targetAvatarImage?: PreparedAvatarImage;
  secondaryTargetAvatarImage?: PreparedAvatarImage;
  botAvatarImage?: PreparedAvatarImage;
}> {
  const pokeRuntimeHints = await resolvePokeRuntimeHints(session);
  const senderAvatarImage = await getSenderAvatarImage(ctx, session, timeoutMs);
  const targetAvatarImage = await getMentionedTargetAvatarImage(
    ctx,
    session,
    timeoutMs,
  );
  const secondaryTargetAvatarImage = await getMentionedSecondaryAvatarImage(
    ctx,
    session,
    timeoutMs,
  );
  const botAvatarImage = await getBotAvatarImage(ctx, session, timeoutMs);

  if (!isPokeTriggerSession(session)) {
    return {
      senderAvatarImage,
      targetAvatarImage,
      secondaryTargetAvatarImage,
      botAvatarImage,
    };
  }

  const actorUserId = pokeRuntimeHints.actorUserId;
  const preferredGuildId = pokeRuntimeHints.preferredGuildId;

  const actorAvatarImage = actorUserId
    ? await resolveAvatarImageByUserId(
        ctx,
        session,
        actorUserId,
        timeoutMs,
        preferredGuildId,
        "poke-actor-avatar",
      )
    : undefined;

  return {
    senderAvatarImage: senderAvatarImage || actorAvatarImage,
    targetAvatarImage: targetAvatarImage || actorAvatarImage,
    secondaryTargetAvatarImage,
    botAvatarImage,
  };
}

function resolvePokeCooldownScopeKey(session: Session): string {
  const channelId = session.channelId?.trim();
  if (channelId) return `channel:${channelId}`;

  const guildId = session.guildId?.trim();
  if (guildId) return `guild:${guildId}`;

  const operatorId = resolvePokeOperatorId(session);
  if (operatorId) return `user:${operatorId}`;

  const userId = session.userId?.trim();
  if (userId) return `user:${userId}`;

  return "global";
}

interface InstallRandomAndPokeRuntimeOptions {
  ctx: Context;
  config: Config;
  client: MemeBackendClient;
  logger: ReturnType<Context["logger"]>;
  ensureCategoryExcludedMemeKeySet: () => Promise<void>;
  filterExcludedMemeKeys: (keys: string[]) => string[];
  handleGenerateWithPreparedInput: (
    key: string,
    texts: string[],
    images: Awaited<ReturnType<typeof parseCommandInput>>["images"],
    senderAvatarImage?: PreparedAvatarImage,
    targetAvatarImage?: PreparedAvatarImage,
    secondaryTargetAvatarImage?: PreparedAvatarImage,
    botAvatarImage?: PreparedAvatarImage,
    senderName?: string,
    groupNicknameText?: string,
    preferredTextSource?: "template-default" | "user-nickname",
  ) => Promise<ReturnType<typeof h.image>>;
  handleErrorReply: (scope: string, message: string) => string;
  handleRuntimeError: (scope: string, error: unknown) => string;
}

export function installRandomAndPokeRuntime(
  options: InstallRandomAndPokeRuntimeOptions,
): void {
  const {
    ctx,
    config,
    client,
    logger,
    ensureCategoryExcludedMemeKeySet,
    filterExcludedMemeKeys,
    handleGenerateWithPreparedInput,
    handleErrorReply,
    handleRuntimeError,
  } = options;

  let randomSelectionHistory = new Map<string, number>();
  let randomSelectionQueue: Promise<void> = Promise.resolve();
  const pokeCooldownHistory = new Map<string, number>();

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

  const runRandomMeme = async (
    session: Session,
    texts: string[],
  ): Promise<string | ReturnType<typeof h.image>> => {
    try {
      await ensureCategoryExcludedMemeKeySet();
      const executeRandom = async () => {
        const shuffledKeys = createShuffledKeys(await client.getKeys());
        const filteredShuffledKeys = filterExcludedMemeKeys(shuffledKeys);
        if (filteredShuffledKeys.length === 0) {
          return replyOrSilent(
            config,
            logger,
            "meme.random",
            "当前后端没有可用模板。",
          );
        }

        const parsedInput = await parseCommandInput(
          ctx,
          session,
          texts,
          config,
        );
        const pokeRuntimeHints = await resolvePokeRuntimeHints(session);
        const senderName =
          pokeRuntimeHints.senderName || getSenderDisplayName(session);
        const groupNicknameEnabled =
          config.autoUseGroupNicknameWhenNoDefaultText;
        const targetDisplayName = groupNicknameEnabled
          ? await getMentionedTargetDisplayName(session)
          : undefined;
        const groupNicknameText = groupNicknameEnabled
          ? targetDisplayName ||
            pokeRuntimeHints.groupNicknameText ||
            senderName
          : undefined;

        const {
          senderAvatarImage,
          targetAvatarImage,
          secondaryTargetAvatarImage,
          botAvatarImage,
        } = await resolvePokeAvatarHints(ctx, session, config.timeoutMs);
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

        for (const key of filteredShuffledKeys) {
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
            logger.warn("meme.random skip key %s: %s", key, String(error));
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
          if (infoFailedCount === filteredShuffledKeys.length) {
            return handleErrorReply(
              "meme.random",
              "随机筛选失败：后端不可用或超时，请稍后重试。",
            );
          }
          return replyOrSilent(
            config,
            logger,
            "meme.random",
            "未找到符合当前输入条件的随机模板，请补充图片或文字后重试。",
          );
        }

        try {
          logger.info("meme trigger key: %s", randomCandidate.key);
          const result = await handleGenerateWithPreparedInput(
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
            const randomTriggerText = randomCandidate.directAlias
              ? randomCandidate.directAlias
              : `meme ${randomCandidate.key}`;
            return `${randomTriggerText}\n${stringifyImageSegment(result)}`;
          }

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
  };

  ctx
    .command("meme.random [...texts]", "随机选择模板并生成 meme 图片")
    .action(async ({ session }, ...texts) => {
      if (!session)
        return handleErrorReply("meme.random", "当前上下文不可用。");
      return await runRandomMeme(session, texts);
    });

  if (config.enablePokeTriggerRandom) {
    ctx.on("internal/session", async (session) => {
      if (session.type !== "notice") return;
      if (!isPokeTriggerSession(session)) return;

      const cooldownSeconds = Math.max(
        0,
        config.pokeTriggerCooldownSeconds || 0,
      );
      if (cooldownSeconds > 0) {
        const scopeKey = resolvePokeCooldownScopeKey(session);
        const now = Date.now();
        const lastTriggerAt = pokeCooldownHistory.get(scopeKey) || 0;
        if (now - lastTriggerAt < cooldownSeconds * 1000) return;
        pokeCooldownHistory.set(scopeKey, now);
      }

      const randomResult = await runRandomMeme(session, []);
      if (!randomResult) return;
      await session.send(randomResult);
    });
  }
}
