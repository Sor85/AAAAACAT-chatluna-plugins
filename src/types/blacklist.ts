/**
 * 黑名单相关类型定义
 * 包含数据库记录、展示结构和服务接口
 */

export type BlacklistMode = "permanent" | "temporary";

export interface BlacklistRecord {
  platform: string;
  userId: string;
  mode: BlacklistMode;
  blockedAt: Date;
  expiresAt: Date | null;
  nickname: string | null;
  note: string | null;
  channelId: string | null;
  durationHours: number | null;
  penalty: number | null;
}

export interface BlacklistEntry {
  platform: string;
  userId: string;
  blockedAt: string;
  nickname?: string;
  note: string;
  channelId?: string;
}

export interface TemporaryBlacklistEntry {
  platform: string;
  userId: string;
  blockedAt: string;
  expiresAt: string;
  nickname?: string;
  note: string;
  channelId?: string;
  durationHours: number | string;
  penalty: number | string;
}

export interface BlacklistDetail {
  note?: string;
  nickname?: string;
  channelId?: string;
  guildId?: string;
  groupId?: string;
}

export interface InMemoryTemporaryEntry {
  expiresAt: number;
  nickname: string;
}
