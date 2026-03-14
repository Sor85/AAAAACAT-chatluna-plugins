/**
 * XML 工具调用运行时
 * 负责 XML 输入构建、temp 消息拦截与生命周期管理
 */

import { h, type Context, type Session } from "koishi";
import type { Config } from "../../config";
import { downloadImage } from "../../utils/image";
import {
  getBotAvatarImage,
  getSenderAvatarImage,
  getSenderDisplayName,
  resolveAvatarImageByUserId,
  resolveDisplayNameByUserId,
} from "../../utils/avatar";
import { extractXmlMemeToolCalls } from "../xml-tool-call";
import type {
  ChatlunaCharacterServiceLike,
  ChatlunaCompletionMessageLike,
  ChatlunaCompletionMessagesLike,
  ChatlunaTempLike,
  ContextWithChatlunaCharacter,
  MaybePromise,
} from "./types";
import type { PreparedImages } from "./generate";

interface XmlGenerateInput {
  texts: string[];
  images: PreparedImages;
  senderAvatarImage?: Awaited<ReturnType<typeof getSenderAvatarImage>>;
  targetAvatarImage?: Awaited<ReturnType<typeof getSenderAvatarImage>>;
  secondaryTargetAvatarImage?: Awaited<ReturnType<typeof getSenderAvatarImage>>;
  senderName?: string;
  groupNicknameText?: string;
}

interface XmlToolSendPayload {
  memeKey: string;
  result: string | ReturnType<typeof h.image>;
}

interface InstallXmlRuntimeOptions {
  ctx: Context;
  config: Config;
  logger: ReturnType<Context["logger"]>;
  ensureCategoryExcludedMemeKeySet: () => Promise<void>;
  resolveMemeKey: (key: string) => Promise<string>;
  isExcludedMemeKey: (key: string) => boolean;
  handleGenerateWithPreparedInput: (
    key: string,
    texts: string[],
    images: PreparedImages,
    senderAvatarImage?: Awaited<ReturnType<typeof getSenderAvatarImage>>,
    targetAvatarImage?: Awaited<ReturnType<typeof getSenderAvatarImage>>,
    secondaryTargetAvatarImage?: Awaited<
      ReturnType<typeof getSenderAvatarImage>
    >,
    botAvatarImage?: Awaited<ReturnType<typeof getSenderAvatarImage>>,
    senderName?: string,
    groupNicknameText?: string,
  ) => Promise<ReturnType<typeof h.image>>;
  handleRuntimeError: (scope: string, error: unknown) => string;
}

interface XmlMessageDispatcher {
  originalPush: ChatlunaCompletionMessagesLike["push"];
  patchedPush: ChatlunaCompletionMessagesLike["push"];
  session: Session | null;
  handledMessages: WeakSet<object>;
}

const GET_TEMP_PATCH_TAG = Symbol("chatlunaMemeGeneratorXmlGetTempPatched");
const GET_TEMP_ORIGINAL = Symbol("chatlunaMemeGeneratorXmlOriginalGetTemp");
const GET_TEMP_DISPATCHERS = Symbol("chatlunaMemeGeneratorXmlDispatchers");
const MESSAGES_DISPATCHER = Symbol(
  "chatlunaMemeGeneratorXmlMessagesDispatcher",
);

function getMessageType(message: ChatlunaCompletionMessageLike | null): string {
  if (!message) return "";
  if (typeof message._getType === "function") {
    return String(message._getType() || "")
      .trim()
      .toLowerCase();
  }
  return String(message.type || message.role || "")
    .trim()
    .toLowerCase();
}

function isAssistantMessage(
  message: ChatlunaCompletionMessageLike | null,
): boolean {
  const type = getMessageType(message);
  return type === "assistant" || type === "ai";
}

function extractTextContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map((item) => extractTextContent(item)).join("");
  }
  if (typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (record.content !== undefined && record.content !== value) {
    return extractTextContent(record.content);
  }
  if (Array.isArray(record.children)) {
    return extractTextContent(record.children);
  }
  if (typeof record.attrs === "object" && record.attrs) {
    const attrs = record.attrs as Record<string, unknown>;
    if (typeof attrs.content === "string") return attrs.content;
    if (typeof attrs.text === "string") return attrs.text;
  }
  return "";
}

function extractAssistantResponse(
  message: ChatlunaCompletionMessageLike | null,
): string {
  if (!isAssistantMessage(message)) return "";
  return extractTextContent(message?.content ?? message?.text).trim();
}

function getMessageDispatcher(
  messages: ChatlunaCompletionMessagesLike,
): XmlMessageDispatcher | null {
  return ((messages as unknown as Record<symbol, unknown>)[
    MESSAGES_DISPATCHER
  ] ?? null) as XmlMessageDispatcher | null;
}

function setMessageDispatcher(
  messages: ChatlunaCompletionMessagesLike,
  dispatcher: XmlMessageDispatcher | null,
): void {
  const record = messages as unknown as Record<symbol, unknown>;
  if (!dispatcher) {
    delete record[MESSAGES_DISPATCHER];
    return;
  }
  Object.defineProperty(record, MESSAGES_DISPATCHER, {
    value: dispatcher,
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

export function installXmlRuntime(options: InstallXmlRuntimeOptions): void {
  const {
    ctx,
    config,
    logger,
    ensureCategoryExcludedMemeKeySet,
    resolveMemeKey,
    isExcludedMemeKey,
    handleGenerateWithPreparedInput,
    handleRuntimeError,
  } = options;

  const buildXmlGenerateInput = async (
    session: Session,
    pickedCall: {
      texts: string[];
      imageSources: string[];
      atUserIds: string[];
    },
  ): Promise<XmlGenerateInput> => {
    const senderName = getSenderDisplayName(session);
    const preferredGuildId =
      session.guildId && session.guildId !== "private"
        ? session.guildId
        : undefined;

    const downloadedImages: PreparedImages = [];
    for (let index = 0; index < pickedCall.imageSources.length; index += 1) {
      const src = pickedCall.imageSources[index];
      const image = await downloadImage(
        ctx,
        src,
        config.timeoutMs,
        `xml-image-${index + 1}`,
      );
      downloadedImages.push(image);
    }

    const atAvatarImages: PreparedImages = [];
    for (let index = 0; index < pickedCall.atUserIds.length; index += 1) {
      const userId = pickedCall.atUserIds[index];
      const avatar = await resolveAvatarImageByUserId(
        ctx,
        session,
        userId,
        config.timeoutMs,
        preferredGuildId,
        `xml-at-avatar-${index + 1}`,
      );
      if (!avatar) continue;
      atAvatarImages.push(avatar);
    }

    let targetDisplayName: string | undefined;
    if (
      config.autoUseGroupNicknameWhenNoDefaultText &&
      pickedCall.atUserIds.length > 0
    ) {
      targetDisplayName = await resolveDisplayNameByUserId(
        session,
        pickedCall.atUserIds[0],
        preferredGuildId,
      );
    }

    const senderAvatarImage = await getSenderAvatarImage(
      ctx,
      session,
      config.timeoutMs,
    );

    return {
      texts: pickedCall.texts,
      images: downloadedImages,
      senderAvatarImage,
      targetAvatarImage: atAvatarImages[0],
      secondaryTargetAvatarImage: atAvatarImages[1],
      senderName,
      groupNicknameText: config.autoUseGroupNicknameWhenNoDefaultText
        ? targetDisplayName || senderName
        : undefined,
    };
  };

  const handleXmlMemeToolCall = async (
    session: Session,
    content: string,
  ): Promise<XmlToolSendPayload | null> => {
    if (!content) return null;

    const toolCalls = extractXmlMemeToolCalls(content);
    if (toolCalls.length === 0) return null;

    const pickedCall = toolCalls[0];
    let resolvedKey = pickedCall.key;

    try {
      await ensureCategoryExcludedMemeKeySet();
      resolvedKey = await resolveMemeKey(pickedCall.key);
      if (isExcludedMemeKey(resolvedKey)) {
        return {
          memeKey: resolvedKey,
          result: "该模板已被排除。",
        };
      }

      const xmlInput = await buildXmlGenerateInput(session, pickedCall);
      const botAvatarImage = await getBotAvatarImage(
        ctx,
        session,
        config.timeoutMs,
      );

      return {
        memeKey: resolvedKey,
        result: await handleGenerateWithPreparedInput(
          resolvedKey,
          xmlInput.texts,
          xmlInput.images,
          xmlInput.senderAvatarImage,
          xmlInput.targetAvatarImage,
          xmlInput.secondaryTargetAvatarImage,
          botAvatarImage,
          xmlInput.senderName,
          xmlInput.groupNicknameText,
        ),
      };
    } catch (error) {
      return {
        memeKey: resolvedKey,
        result: handleRuntimeError("meme.xml", error),
      };
    }
  };

  const dispatchXmlToolCall = async (
    session: Session | null,
    content: string,
  ): Promise<void> => {
    if (!session || !content) return;
    try {
      const payload = await handleXmlMemeToolCall(session, content);
      if (!payload) return;
      await session.send(payload.result);
      logger.info(
        "meme=%s, user=%s, guild=%s",
        payload.memeKey,
        session.userId,
        session.guildId,
      );
    } catch (error) {
      logger.warn("meme.xml temp runtime failed: %s", String(error));
    }
  };

  const attachMessageDispatcher = (
    messages: ChatlunaCompletionMessagesLike,
    session: Session | null,
  ): void => {
    const existingDispatcher = getMessageDispatcher(messages);
    if (existingDispatcher) {
      existingDispatcher.session = session;
      return;
    }

    const originalPush = messages.push;
    const handledMessages = new WeakSet<object>();
    const patchedPush: ChatlunaCompletionMessagesLike["push"] =
      function patchedPush(
        this: ChatlunaCompletionMessagesLike,
        ...items: unknown[]
      ): number {
        const result = originalPush.apply(this, items);

        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          if (handledMessages.has(item)) continue;
          handledMessages.add(item);

          const response = extractAssistantResponse(
            item as ChatlunaCompletionMessageLike,
          );
          if (!response) continue;
          void dispatchXmlToolCall(dispatcher.session, response);
        }

        return result;
      };

    const dispatcher: XmlMessageDispatcher = {
      originalPush,
      patchedPush,
      session,
      handledMessages,
    };

    messages.push = patchedPush;
    setMessageDispatcher(messages, dispatcher);
  };

  const restoreMessageDispatcher = (
    messages: ChatlunaCompletionMessagesLike,
  ): void => {
    const dispatcher = getMessageDispatcher(messages);
    if (!dispatcher) return;
    if (messages.push === dispatcher.patchedPush) {
      messages.push = dispatcher.originalPush;
    }
    setMessageDispatcher(messages, null);
  };

  const bindCharacterService = (
    service: ChatlunaCharacterServiceLike,
  ): (() => void) | null => {
    const getTemp = service.getTemp;
    if (typeof getTemp !== "function") return null;

    const serviceRecord = service as unknown as Record<symbol, unknown>;
    const trackedDispatchers = new Set<ChatlunaCompletionMessagesLike>();

    if (!(serviceRecord[GET_TEMP_PATCH_TAG] as boolean)) {
      Object.defineProperty(serviceRecord, GET_TEMP_ORIGINAL, {
        value: getTemp,
        configurable: true,
        enumerable: false,
        writable: true,
      });
      Object.defineProperty(serviceRecord, GET_TEMP_DISPATCHERS, {
        value: trackedDispatchers,
        configurable: true,
        enumerable: false,
        writable: true,
      });

      service.getTemp = async (...args: unknown[]) => {
        const originalGetTemp = serviceRecord[GET_TEMP_ORIGINAL] as
          | ((
              ...innerArgs: unknown[]
            ) => MaybePromise<ChatlunaTempLike | undefined>)
          | undefined;
        const temp = originalGetTemp
          ? await Promise.resolve(originalGetTemp.call(service, ...args))
          : undefined;
        const messages = temp?.completionMessages;
        if (Array.isArray(messages) && typeof messages.push === "function") {
          trackedDispatchers.add(messages);
          attachMessageDispatcher(
            messages,
            args[0] && typeof args[0] === "object"
              ? (args[0] as Session)
              : null,
          );
        }
        return temp;
      };

      serviceRecord[GET_TEMP_PATCH_TAG] = true;
    }

    return () => {
      const originalGetTemp = serviceRecord[
        GET_TEMP_ORIGINAL
      ] as ChatlunaCharacterServiceLike["getTemp"];
      const dispatchers = serviceRecord[GET_TEMP_DISPATCHERS] as
        | Set<ChatlunaCompletionMessagesLike>
        | undefined;

      for (const messages of Array.from(dispatchers ?? [])) {
        restoreMessageDispatcher(messages);
      }

      if (typeof originalGetTemp === "function") {
        service.getTemp = originalGetTemp;
      }
      delete serviceRecord[GET_TEMP_PATCH_TAG];
      delete serviceRecord[GET_TEMP_ORIGINAL];
      delete serviceRecord[GET_TEMP_DISPATCHERS];
    };
  };

  let restoreCharacterService: (() => void) | null = null;
  let activeCharacterService: ChatlunaCharacterServiceLike | null = null;
  let characterCtx: ContextWithChatlunaCharacter | null = null;

  const activateXmlRuntime = (
    runtimeCtx: ContextWithChatlunaCharacter = characterCtx ??
      (ctx as ContextWithChatlunaCharacter),
  ): void => {
    const characterService = runtimeCtx.chatluna_character;
    if (!characterService || typeof characterService.getTemp !== "function") {
      logger.warn("chatluna_character.getTemp 挂载失败，XML 工具不会启用");
      return;
    }

    if (
      restoreCharacterService &&
      activeCharacterService === characterService
    ) {
      return;
    }

    restoreCharacterService?.();
    restoreCharacterService = bindCharacterService(characterService);
    activeCharacterService = restoreCharacterService ? characterService : null;

    if (restoreCharacterService) {
      logger.info("已启用基于 temp 的 XML 工具调用模式");
      return;
    }

    logger.warn("chatluna_character.getTemp 挂载失败，XML 工具不会启用");
  };

  ctx.inject(["chatluna_character"], (innerCtx) => {
    characterCtx = innerCtx as ContextWithChatlunaCharacter;
    activateXmlRuntime(characterCtx);
    innerCtx.on("dispose", () => {
      if (characterCtx === innerCtx) {
        characterCtx = null;
      }
      restoreCharacterService?.();
      restoreCharacterService = null;
      activeCharacterService = null;
    });
  });

  ctx.on("dispose", () => {
    characterCtx = null;
    restoreCharacterService?.();
    restoreCharacterService = null;
    activeCharacterService = null;
  });
}
