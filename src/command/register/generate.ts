/**
 * meme 生成管线
 * 统一处理输入解析、自动补全与后端生成调用
 */

import { h, type Context, type Session } from "koishi";
import type { Config } from "../../config";
import { applyAutoFillPolicy } from "../../domain/policy";
import { MemeBackendClient } from "../../infra/client";
import { parseCommandInput } from "../parse";
import {
  getBotAvatarImage,
  getMentionedSecondaryAvatarImage,
  getMentionedTargetAvatarImage,
  getMentionedTargetDisplayName,
  getSenderAvatarImage,
  getSenderDisplayName,
} from "../../utils/avatar";
import { mapRuntimeErrorMessage } from "./errors";

export type PreparedImages = Awaited<ReturnType<typeof parseCommandInput>>["images"];
export type PreparedAvatarImage = Awaited<ReturnType<typeof getSenderAvatarImage>>;

export function buildRandomConfig(config: Config): Config {
  return {
    ...config,
    autoUseAvatarWhenMinImagesOneAndNoImage: true,
    autoFillOneMissingImageWithAvatar: true,
    autoFillSenderAndBotAvatarsWhenMinImagesTwoAndNoImage: true,
  };
}

export async function handleGenerate(
  ctx: Context,
  session: Session,
  client: MemeBackendClient,
  config: Config,
  key: string,
  texts: string[],
): Promise<string | ReturnType<typeof h.image>> {
  try {
    ctx.logger("chatluna-meme-generator").info("meme trigger key: %s", key);
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

export async function handleGenerateWithPreparedInput(
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
