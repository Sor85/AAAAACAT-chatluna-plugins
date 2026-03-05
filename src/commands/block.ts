/**
 * 拉黑与解除拉黑命令
 * 手动管理永久黑名单
 */

import type { Session } from "koishi";
import type { CommandDependencies } from "./types";
import type { BlacklistService } from "../services/blacklist/repository";

export interface BlockCommandDeps extends CommandDependencies {
  blacklist: BlacklistService;
}

export function registerBlockCommand(deps: BlockCommandDeps) {
  const {
    ctx,
    cache,
    blacklist,
    resolveUserIdentity,
    resolveGroupId,
    stripAtPrefix,
    fetchMember,
  } = deps;

  ctx
    .command(
      "affinity.block <userId:string> [platform:string]",
      "手动将用户加入黑名单",
      { authority: 4 },
    )
    .option("note", "-n <note:text> 备注信息")
    .alias("拉黑人")
    .action(async ({ session, options }, userId, platformArg) => {
      const platform = platformArg || session?.platform;
      if (!platform) return "请指定平台。";
      const groupId = resolveGroupId(session as Session);
      const resolved = await resolveUserIdentity(session as Session, userId);
      const normalizedUserId = resolved?.userId || stripAtPrefix(userId);
      if (!normalizedUserId) return "用户 ID 不能为空。";
      if (await blacklist.isBlacklisted(platform, normalizedUserId, groupId)) {
        return `${platform}/${normalizedUserId} 已在永久黑名单中。`;
      }
      const note = options?.note || "manual";
      await blacklist.recordPermanent(platform, normalizedUserId, {
        note,
        nickname: resolved?.nickname || normalizedUserId,
        channelId: groupId,
      });
      cache.clear(platform, normalizedUserId);
      const nicknameDisplay = resolved?.nickname || normalizedUserId;
      return `已将 ${nicknameDisplay} (${normalizedUserId}) 加入永久黑名单。`;
    });

  ctx
    .command(
      "affinity.unblock <userId:string> [platform:string]",
      "解除永久黑名单",
      { authority: 4 },
    )
    .alias("解除拉黑")
    .action(async ({ session }, userId, platformArg) => {
      const platform = platformArg || session?.platform;
      if (!platform) return "请指定平台。";
      const normalizedUserId = stripAtPrefix(userId);
      if (!normalizedUserId) return "用户 ID 不能为空。";
      const groupId = resolveGroupId(session as Session);
      const removed = await blacklist.removePermanent(
        platform,
        normalizedUserId,
        groupId,
      );
      cache.clear(platform, normalizedUserId);
      if (removed) {
        let nickname = normalizedUserId;
        if (session) {
          const memberInfo = await fetchMember(
            session as Session,
            normalizedUserId,
          );
          if (memberInfo) {
            const raw = memberInfo as unknown as Record<string, unknown>;
            const card =
              raw.card || (raw.user as Record<string, unknown>)?.card;
            const nick =
              raw.nickname ||
              raw.nick ||
              (raw.user as Record<string, unknown>)?.nickname;
            nickname = String(card || nick || normalizedUserId).trim();
          }
        }
        return `已解除 ${nickname}(${normalizedUserId}) 的永久黑名单。`;
      }
      return `${normalizedUserId} 不在永久黑名单中。`;
    });
}
