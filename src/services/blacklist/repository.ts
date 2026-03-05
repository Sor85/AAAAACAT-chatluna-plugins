/**
 * 黑名单数据库服务
 * 提供永久/临时黑名单的数据库读写与过期清理
 */

import type { Context } from "koishi";
import type {
  BlacklistDetail,
  BlacklistEntry,
  BlacklistMode,
  BlacklistRecord,
  Config,
  LogFn,
  TemporaryBlacklistEntry,
} from "../../types";
import { formatBeijingTimestamp } from "../../utils";
import { BLACKLIST_MODEL_NAME } from "../../models";

export interface BlacklistServiceOptions {
  ctx: Context;
  config: Config;
  log: LogFn;
}

export function createBlacklistService(options: BlacklistServiceOptions) {
  const { ctx, config, log } = options;

  const normalizeDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const toPermanentEntry = (record: BlacklistRecord): BlacklistEntry => ({
    platform: record.platform,
    userId: record.userId,
    blockedAt: formatBeijingTimestamp(record.blockedAt),
    nickname: record.nickname || "",
    note: record.note || "",
    channelId: record.channelId || "",
  });

  const toTemporaryEntry = (
    record: BlacklistRecord,
  ): TemporaryBlacklistEntry => ({
    platform: record.platform,
    userId: record.userId,
    blockedAt: formatBeijingTimestamp(record.blockedAt),
    expiresAt: formatBeijingTimestamp(record.expiresAt || new Date(0)),
    nickname: record.nickname || "",
    note: record.note || "",
    channelId: record.channelId || "",
    durationHours: record.durationHours ?? "",
    penalty: record.penalty ?? "",
  });

  const listByMode = async (
    mode: BlacklistMode,
    platform?: string,
  ): Promise<BlacklistRecord[]> => {
    const query = platform ? { mode, platform } : { mode };
    const list = await ctx.database.get(BLACKLIST_MODEL_NAME, query);
    return list as unknown as BlacklistRecord[];
  };

  const removeExpiredTemporary = async (): Promise<void> => {
    const now = new Date();
    const temporary = await listByMode("temporary");
    const expired = temporary.filter((item) => {
      const expiresAt = normalizeDate(item.expiresAt);
      return !expiresAt || expiresAt.getTime() <= now.getTime();
    });
    if (!expired.length) return;
    await Promise.all(
      expired.map((item) =>
        ctx.database.remove(BLACKLIST_MODEL_NAME, {
          platform: item.platform,
          userId: item.userId,
          mode: "temporary",
        }),
      ),
    );
  };

  const isBlacklisted = async (
    platform: string,
    userId: string,
    _channelId?: string,
  ): Promise<boolean> => {
    const rows = (await ctx.database.get(BLACKLIST_MODEL_NAME, {
      platform,
      userId,
      mode: "permanent",
    })) as unknown as BlacklistRecord[];
    return rows.length > 0;
  };

  const isTemporarilyBlacklisted = async (
    platform: string,
    userId: string,
  ): Promise<TemporaryBlacklistEntry | null> => {
    await removeExpiredTemporary();
    const rows = (await ctx.database.get(BLACKLIST_MODEL_NAME, {
      platform,
      userId,
      mode: "temporary",
    })) as unknown as BlacklistRecord[];
    if (!rows.length) return null;
    const first = rows[0];
    const expiresAt = normalizeDate(first.expiresAt);
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      await ctx.database.remove(BLACKLIST_MODEL_NAME, {
        platform,
        userId,
        mode: "temporary",
      });
      return null;
    }
    return toTemporaryEntry(first);
  };

  const listPermanent = async (
    platform?: string,
  ): Promise<BlacklistEntry[]> => {
    const records = await listByMode("permanent", platform);
    return records.map(toPermanentEntry);
  };

  const listTemporary = async (
    platform?: string,
  ): Promise<TemporaryBlacklistEntry[]> => {
    await removeExpiredTemporary();
    const records = await listByMode("temporary", platform);
    return records
      .filter((record) => {
        const expiresAt = normalizeDate(record.expiresAt);
        return Boolean(expiresAt && expiresAt.getTime() > Date.now());
      })
      .map(toTemporaryEntry);
  };

  const recordPermanent = async (
    platform: string,
    userId: string,
    detail?: BlacklistDetail,
  ): Promise<BlacklistEntry | null> => {
    const existing = await isBlacklisted(platform, userId);
    if (existing) return null;
    const row: BlacklistRecord = {
      platform,
      userId,
      mode: "permanent",
      blockedAt: new Date(),
      expiresAt: null,
      nickname: detail?.nickname || null,
      note: detail?.note || "",
      channelId: detail?.channelId || detail?.guildId || detail?.groupId || "",
      durationHours: null,
      penalty: null,
    };
    await ctx.database.upsert(BLACKLIST_MODEL_NAME, [row as never]);
    log("info", "已记录永久拉黑用户", { platform, userId });
    return toPermanentEntry(row);
  };

  const removePermanent = async (
    platform: string,
    userId: string,
    _channelId?: string,
  ): Promise<boolean> => {
    const existing = await isBlacklisted(platform, userId);
    if (!existing) return false;
    await ctx.database.remove(BLACKLIST_MODEL_NAME, {
      platform,
      userId,
      mode: "permanent",
    });
    return true;
  };

  const recordTemporary = async (
    platform: string,
    userId: string,
    durationHours: number,
    penalty: number,
    detail?: BlacklistDetail,
  ): Promise<TemporaryBlacklistEntry | null> => {
    const existing = await isTemporarilyBlacklisted(platform, userId);
    if (existing) return null;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    const row: BlacklistRecord = {
      platform,
      userId,
      mode: "temporary",
      blockedAt: now,
      expiresAt,
      nickname: detail?.nickname || null,
      note: detail?.note || "",
      channelId: detail?.channelId || detail?.guildId || detail?.groupId || "",
      durationHours,
      penalty,
    };
    await ctx.database.upsert(BLACKLIST_MODEL_NAME, [row as never]);
    log("info", "已记录临时拉黑用户", {
      platform,
      userId,
      durationHours,
      penalty,
    });
    return toTemporaryEntry(row);
  };

  const removeTemporary = async (
    platform: string,
    userId: string,
  ): Promise<boolean> => {
    const existing = await isTemporarilyBlacklisted(platform, userId);
    if (!existing) return false;
    await ctx.database.remove(BLACKLIST_MODEL_NAME, {
      platform,
      userId,
      mode: "temporary",
    });
    return true;
  };

  const shouldBlock = async (
    platform: string,
    userId: string,
  ): Promise<boolean> => {
    if (await isBlacklisted(platform, userId)) return true;
    const temporary = await isTemporarilyBlacklisted(platform, userId);
    return Boolean(temporary);
  };

  const clearAll = async (): Promise<void> => {
    await ctx.database.remove(BLACKLIST_MODEL_NAME, {});
  };

  return {
    shouldBlock,
    isBlacklisted,
    isTemporarilyBlacklisted,
    listPermanent,
    listTemporary,
    recordPermanent,
    removePermanent,
    recordTemporary,
    removeTemporary,
    clearAll,
  };
}

export type BlacklistService = ReturnType<typeof createBlacklistService>;
