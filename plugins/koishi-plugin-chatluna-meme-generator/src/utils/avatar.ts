/**
 * 头像与昵称提取工具
 * 提供发送者、被@用户与 bot 的头像和显示名获取能力
 */

import type { Context, Session } from "koishi";
import type { GenerateImageInput } from "../types";
import { downloadImage } from "./image";

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

const SPECIAL_MENTION_IDS = new Set(["all", "here"]);
const DISPLAY_NAME_MAX_LENGTH = 64;

export function getSenderAvatarSrc(session: Session): string | undefined {
  const avatar = session.author?.avatar;
  if (avatar) return String(avatar);

  const fromEvent = session.event.user?.avatar;
  if (fromEvent) return String(fromEvent);

  return undefined;
}

export function getSenderDisplayName(session: Session): string | undefined {
  const memberNick = normalizeDisplayName(session.author?.nick);
  if (memberNick) return memberNick;

  const memberName = normalizeDisplayName(session.author?.name);
  if (memberName) return memberName;

  const eventNick = normalizeDisplayName(session.event.user?.nick);
  if (eventNick) return eventNick;

  const eventName = normalizeDisplayName(session.event.user?.name);
  if (eventName) return eventName;

  const username = normalizeDisplayName(session.username);
  if (username) return username;

  return undefined;
}

export async function getSenderAvatarImage(
  ctx: Context,
  session: Session,
  timeoutMs: number,
): Promise<GenerateImageInput | undefined> {
  const src = getSenderAvatarSrc(session);
  if (!src) return undefined;

  try {
    return await downloadImage(ctx, src, timeoutMs, "avatar");
  } catch (error) {
    ctx
      .logger("chatluna-meme-generator")
      .warn("头像下载失败：%s", String(error));
    return undefined;
  }
}

function getMentionedUsers(elements: readonly ElementLike[] = []): Array<{
  userId: string;
  displayName?: string;
}> {
  const result: Array<{ userId: string; displayName?: string }> = [];
  const visited = new Set<string>();

  const walk = (nodes: readonly ElementLike[]): void => {
    for (const node of nodes) {
      if (node.type === "at") {
        const rawId = node.attrs?.id ?? node.attrs?.userId ?? node.attrs?.qq;
        const userId = rawId ? String(rawId).trim() : "";

        if (
          userId &&
          !SPECIAL_MENTION_IDS.has(userId) &&
          !visited.has(userId)
        ) {
          const displayName = normalizeDisplayName(node.attrs?.name);
          visited.add(userId);
          result.push({ userId, displayName });
        }
      }

      if (node.children?.length) walk(node.children);
    }
  };

  walk(elements);
  return result;
}

function pickMentionedTargetUsers(
  session: Session,
): Array<{ userId: string; displayName?: string }> {
  const mentionedUsers = getMentionedUsers(session.elements as ElementLike[]);
  if (mentionedUsers.length === 0) return [];

  const nonSelfMentions = mentionedUsers.filter(
    (mentionedUser) => mentionedUser.userId !== session.userId,
  );
  if (nonSelfMentions.length > 0) return nonSelfMentions;

  return [mentionedUsers[0]];
}

function pickMentionedTargetUser(
  session: Session,
): { userId: string; displayName?: string } | undefined {
  return pickMentionedTargetUsers(session)[0];
}

function normalizeDisplayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, DISPLAY_NAME_MAX_LENGTH);
  if (!trimmed) return undefined;
  return trimmed;
}

function getDisplayNameFromMember(member: unknown): string | undefined {
  if (!member || typeof member !== "object") return undefined;

  const memberRecord = member as {
    nick?: unknown;
    name?: unknown;
    user?: {
      nick?: unknown;
      name?: unknown;
      nickname?: unknown;
      username?: unknown;
    };
  };

  return (
    normalizeDisplayName(memberRecord.nick) ||
    normalizeDisplayName(memberRecord.name) ||
    normalizeDisplayName(memberRecord.user?.nick) ||
    normalizeDisplayName(memberRecord.user?.name) ||
    normalizeDisplayName(memberRecord.user?.nickname) ||
    normalizeDisplayName(memberRecord.user?.username)
  );
}

function getDisplayNameFromUser(user: unknown): string | undefined {
  if (!user || typeof user !== "object") return undefined;

  const userRecord = user as {
    nick?: unknown;
    name?: unknown;
    nickname?: unknown;
    username?: unknown;
  };

  return (
    normalizeDisplayName(userRecord.nick) ||
    normalizeDisplayName(userRecord.name) ||
    normalizeDisplayName(userRecord.nickname) ||
    normalizeDisplayName(userRecord.username)
  );
}

export async function resolveAvatarSrcByUserId(
  session: Session,
  userId: string,
  preferredGuildId?: string,
): Promise<string | undefined> {
  const guildId = preferredGuildId ?? session.guildId;

  if (guildId) {
    try {
      const member = await session.bot.getGuildMember(guildId, userId);
      const fromMember = member.avatar || member.user?.avatar;
      if (fromMember) return String(fromMember);
    } catch (error) {
      session.bot.logger?.debug?.(
        "getGuildMember failed for %s/%s: %s",
        guildId,
        userId,
        String(error),
      );
    }

    try {
      const userInGuild = await session.bot.getUser(userId, guildId);
      if (userInGuild.avatar) return String(userInGuild.avatar);
    } catch (error) {
      session.bot.logger?.debug?.(
        "getUser(guild) failed for %s/%s: %s",
        guildId,
        userId,
        String(error),
      );
    }
  }

  try {
    const user = await session.bot.getUser(userId);
    if (user.avatar) return String(user.avatar);
  } catch (error) {
    session.bot.logger?.debug?.(
      "getUser failed for %s: %s",
      userId,
      String(error),
    );
  }

  return undefined;
}

export async function resolveAvatarImageByUserId(
  ctx: Context,
  session: Session,
  userId: string,
  timeoutMs: number,
  preferredGuildId?: string,
  filenamePrefix = "resolved-avatar",
): Promise<GenerateImageInput | undefined> {
  let src: string | undefined;
  try {
    src = await resolveAvatarSrcByUserId(session, userId, preferredGuildId);
  } catch (error) {
    ctx
      .logger("chatluna-meme-generator")
      .warn("按用户ID获取头像失败：%s", String(error));
    return undefined;
  }

  if (!src) return undefined;

  try {
    return await downloadImage(ctx, src, timeoutMs, filenamePrefix);
  } catch (error) {
    ctx
      .logger("chatluna-meme-generator")
      .warn("按用户ID下载头像失败：%s", String(error));
    return undefined;
  }
}

export async function resolveDisplayNameByUserId(
  session: Session,
  userId: string,
  preferredGuildId?: string,
): Promise<string | undefined> {
  const guildId = preferredGuildId ?? session.guildId;

  if (guildId) {
    try {
      const member = await session.bot.getGuildMember(guildId, userId);
      const fromMember = getDisplayNameFromMember(member);
      if (fromMember) return fromMember;
    } catch (error) {
      session.bot.logger?.debug?.(
        "getGuildMember(displayName) failed for %s/%s: %s",
        guildId,
        userId,
        String(error),
      );
    }

    try {
      const userInGuild = await session.bot.getUser(userId, guildId);
      const fromUserInGuild = getDisplayNameFromUser(userInGuild);
      if (fromUserInGuild) return fromUserInGuild;
    } catch (error) {
      session.bot.logger?.debug?.(
        "getUser(guild,displayName) failed for %s/%s: %s",
        guildId,
        userId,
        String(error),
      );
    }
  }

  try {
    const user = await session.bot.getUser(userId);
    const fromUser = getDisplayNameFromUser(user);
    if (fromUser) return fromUser;
  } catch (error) {
    session.bot.logger?.debug?.(
      "getUser(displayName) failed for %s: %s",
      userId,
      String(error),
    );
  }

  return undefined;
}

async function resolveMentionedAvatarImage(
  ctx: Context,
  session: Session,
  timeoutMs: number,
  userId: string,
  filenamePrefix: string,
  warningLabel: string,
): Promise<GenerateImageInput | undefined> {
  let src: string | undefined;
  try {
    src = await resolveAvatarSrcByUserId(session, userId);
  } catch (error) {
    ctx
      .logger("chatluna-meme-generator")
      .warn("%s获取失败：%s", warningLabel, String(error));
    return undefined;
  }

  if (!src) return undefined;

  try {
    return await downloadImage(ctx, src, timeoutMs, filenamePrefix);
  } catch (error) {
    ctx
      .logger("chatluna-meme-generator")
      .warn("%s下载失败：%s", warningLabel, String(error));
    return undefined;
  }
}

export async function getMentionedAvatarImages(
  ctx: Context,
  session: Session,
  timeoutMs: number,
): Promise<GenerateImageInput[]> {
  const targetUsers = pickMentionedTargetUsers(session);
  const images: GenerateImageInput[] = [];

  for (let index = 0; index < targetUsers.length; index += 1) {
    const targetUser = targetUsers[index];
    const image = await resolveMentionedAvatarImage(
      ctx,
      session,
      timeoutMs,
      targetUser.userId,
      `mentioned-avatar-${index + 1}`,
      `第${index + 1}个被@用户头像`,
    );
    if (image) images.push(image);
  }

  return images;
}

export async function getMentionedTargetAvatarImage(
  ctx: Context,
  session: Session,
  timeoutMs: number,
): Promise<GenerateImageInput | undefined> {
  const targetUser = pickMentionedTargetUser(session);
  if (!targetUser) return undefined;

  return await resolveMentionedAvatarImage(
    ctx,
    session,
    timeoutMs,
    targetUser.userId,
    "mentioned-avatar",
    "被@用户头像",
  );
}

export async function getMentionedSecondaryAvatarImage(
  ctx: Context,
  session: Session,
  timeoutMs: number,
): Promise<GenerateImageInput | undefined> {
  const targetUsers = pickMentionedTargetUsers(session);
  if (targetUsers.length < 2) return undefined;

  return await resolveMentionedAvatarImage(
    ctx,
    session,
    timeoutMs,
    targetUsers[1].userId,
    "mentioned-secondary-avatar",
    "第二被@用户头像",
  );
}

export async function getMentionedTargetDisplayName(
  session: Session,
): Promise<string | undefined> {
  const targetUser = pickMentionedTargetUser(session);
  if (!targetUser) return undefined;
  if (targetUser.displayName) return targetUser.displayName;

  return await resolveDisplayNameByUserId(session, targetUser.userId);
}

export async function getBotAvatarSrc(
  session: Session,
): Promise<string | undefined> {
  const fromBotUser = session.bot.user?.avatar;
  if (fromBotUser) return String(fromBotUser);

  const login = await session.bot.getLogin();
  const fromLogin = login.user?.avatar;
  if (fromLogin) return String(fromLogin);

  return undefined;
}

export async function getBotAvatarImage(
  ctx: Context,
  session: Session,
  timeoutMs: number,
): Promise<GenerateImageInput | undefined> {
  let src: string | undefined;

  try {
    src = await getBotAvatarSrc(session);
  } catch (error) {
    ctx
      .logger("chatluna-meme-generator")
      .warn("bot 头像获取失败：%s", String(error));
    return undefined;
  }

  if (!src) return undefined;

  try {
    return await downloadImage(ctx, src, timeoutMs, "bot-avatar");
  } catch (error) {
    ctx
      .logger("chatluna-meme-generator")
      .warn("bot 头像下载失败：%s", String(error));
    return undefined;
  }
}
