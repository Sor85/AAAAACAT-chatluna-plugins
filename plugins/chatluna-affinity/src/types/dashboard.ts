/**
 * 仪表盘快照类型
 */

export interface DashboardSnapshotRecord {
  scopeId: string;
  date: string;
  recordedAt: Date;
  generatedBy: string | null;
  users: number;
  affinityTotal: number;
  longTermAffinityTotal: number;
  shortTermAffinityTotal: number;
  chatCount: number;
  blacklisted: number;
  permanentBlacklisted: number;
  temporaryBlacklisted: number;
  aliases: number;
  latestInteractionAt: Date | null;
}

export interface UserAffinitySnapshotRecord {
  scopeId: string;
  userId: string;
  date: string;
  recordedAt: Date;
  nickname: string | null;
  affinity: number;
  longTermAffinity: number;
  shortTermAffinity: number;
  chatCount: number;
  relation: string | null;
  specialRelation: string | null;
  lastInteractionAt: Date | null;
}
