/**
 * 仪表盘趋势快照
 */

import type { Context } from "koishi";
import {
  BLACKLIST_MODEL_NAME_V2,
  DASHBOARD_SNAPSHOT_MODEL_NAME,
  MODEL_NAME_V2,
  USER_AFFINITY_SNAPSHOT_MODEL_NAME,
  USER_ALIAS_MODEL_NAME_V2,
} from "../../models";
import type {
  AffinityRecord,
  BlacklistRecord,
  DashboardSnapshotRecord,
  UserAffinitySnapshotRecord,
  UserAliasRecord,
} from "../../types";

export interface DashboardSnapshotSource {
  affinityRows: AffinityRecord[];
  blacklistRows: BlacklistRecord[];
  aliasRows: UserAliasRecord[];
}

export interface RecordedDashboardSnapshots {
  dashboardSnapshots: DashboardSnapshotRecord[];
  userAffinitySnapshots: UserAffinitySnapshotRecord[];
}

export function formatSnapshotDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseSnapshotDate(value: string): Date | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export async function readDashboardSnapshotSource(
  ctx: Context,
  scopeId: string,
): Promise<DashboardSnapshotSource> {
  const affinityRows = await ctx.database.get(MODEL_NAME_V2, { scopeId });
  const blacklistRows = await ctx.database.get(BLACKLIST_MODEL_NAME_V2, {
    scopeId,
  });
  const aliasRows = await ctx.database.get(USER_ALIAS_MODEL_NAME_V2, {
    scopeId,
  });

  return { affinityRows, blacklistRows, aliasRows };
}

export function createDashboardSnapshot(
  scopeId: string,
  now: Date,
  source: DashboardSnapshotSource,
): DashboardSnapshotRecord {
  return {
    scopeId,
    date: formatSnapshotDate(now),
    recordedAt: now,
    users: source.affinityRows.length,
    affinityTotal: source.affinityRows.reduce(
      (total, row) => total + Number(row.affinity || 0),
      0,
    ),
    chatCount: source.affinityRows.reduce(
      (total, row) => total + Number(row.chatCount || 0),
      0,
    ),
    blacklisted: source.blacklistRows.length,
    aliases: source.aliasRows.length,
  };
}

export function createUserAffinitySnapshots(
  scopeId: string,
  now: Date,
  source: DashboardSnapshotSource,
): UserAffinitySnapshotRecord[] {
  const date = formatSnapshotDate(now);
  return source.affinityRows.map((row) => ({
    scopeId,
    userId: row.userId,
    date,
    recordedAt: now,
    affinity: Number(row.affinity || 0),
  }));
}

function hasSnapshotSourceData(source: DashboardSnapshotSource): boolean {
  return (
    source.affinityRows.length > 0 ||
    source.blacklistRows.length > 0 ||
    source.aliasRows.length > 0
  );
}

export function mergeDashboardSnapshot(
  rows: DashboardSnapshotRecord[],
  snapshot: DashboardSnapshotRecord,
): DashboardSnapshotRecord[] {
  return [
    ...rows.filter(
      (row) => row.scopeId !== snapshot.scopeId || row.date !== snapshot.date,
    ),
    snapshot,
  ];
}

export function mergeUserAffinitySnapshots(
  rows: UserAffinitySnapshotRecord[],
  snapshots: UserAffinitySnapshotRecord[],
): UserAffinitySnapshotRecord[] {
  const snapshotKeys = new Set(
    snapshots.map(
      (snapshot) =>
        `${snapshot.scopeId}:${snapshot.userId}:${snapshot.date}`,
    ),
  );

  return [
    ...rows.filter(
      (row) => !snapshotKeys.has(`${row.scopeId}:${row.userId}:${row.date}`),
    ),
    ...snapshots,
  ];
}

export async function recordDashboardSnapshot(
  ctx: Context,
  options: {
    scopeId: string;
    now?: Date;
    source?: DashboardSnapshotSource;
    existingSnapshots?: DashboardSnapshotRecord[];
    existingUserAffinitySnapshots?: UserAffinitySnapshotRecord[];
  },
): Promise<RecordedDashboardSnapshots> {
  const scopeId = options.scopeId.trim();
  if (!scopeId) {
    return { dashboardSnapshots: [], userAffinitySnapshots: [] };
  }

  const now = options.now || new Date();
  const source =
    options.source || (await readDashboardSnapshotSource(ctx, scopeId));
  const existingSnapshots =
    options.existingSnapshots ||
    (await ctx.database.get(DASHBOARD_SNAPSHOT_MODEL_NAME, { scopeId }));
  const existingUserAffinitySnapshots =
    options.existingUserAffinitySnapshots ||
    (await ctx.database.get(USER_AFFINITY_SNAPSHOT_MODEL_NAME, { scopeId }));

  if (!hasSnapshotSourceData(source) && existingSnapshots.length === 0) {
    return {
      dashboardSnapshots: existingSnapshots,
      userAffinitySnapshots: existingUserAffinitySnapshots,
    };
  }

  const snapshot = createDashboardSnapshot(scopeId, now, source);
  const userSnapshots = createUserAffinitySnapshots(scopeId, now, source);
  // 旧实现把当前状态表的 lastInteractionAt 当历史分桶，刷新当天快照后，趋势/周对比才能只依赖真实记录过的日期。
  await ctx.database.upsert(DASHBOARD_SNAPSHOT_MODEL_NAME, [snapshot]);
  if (userSnapshots.length > 0) {
    await ctx.database.upsert(USER_AFFINITY_SNAPSHOT_MODEL_NAME, userSnapshots);
  }

  return {
    dashboardSnapshots: mergeDashboardSnapshot(existingSnapshots, snapshot),
    userAffinitySnapshots: mergeUserAffinitySnapshots(
      existingUserAffinitySnapshots,
      userSnapshots,
    ),
  };
}
