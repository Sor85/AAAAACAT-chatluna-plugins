/**
 * 仪表盘快照类型
 */

export interface DashboardSnapshotRecord {
  scopeId: string;
  date: string;
  recordedAt: Date;
  users: number;
  affinityTotal: number;
  chatCount: number;
  blacklisted: number;
  aliases: number;
}

export interface UserAffinitySnapshotRecord {
  scopeId: string;
  userId: string;
  date: string;
  recordedAt: Date;
  affinity: number;
}
