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

type SnapshotTrigger = "backend" | "manual";

export interface RecordedDashboardSnapshots {
  dashboardSnapshots: DashboardSnapshotRecord[];
  userAffinitySnapshots: UserAffinitySnapshotRecord[];
}

export async function readRecordedDashboardSnapshots(
  ctx: Context,
  scopeId: string,
): Promise<RecordedDashboardSnapshots> {
  const dashboardSnapshots = await ctx.database.get(
    DASHBOARD_SNAPSHOT_MODEL_NAME,
    { scopeId },
  );
  const userAffinitySnapshots = await ctx.database.get(
    USER_AFFINITY_SNAPSHOT_MODEL_NAME,
    { scopeId },
  );

  return { dashboardSnapshots, userAffinitySnapshots };
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
  trigger: SnapshotTrigger = "backend",
): DashboardSnapshotRecord {
  const permanentBlacklisted = source.blacklistRows.filter(
    (row) => row.mode === "permanent",
  ).length;
  const temporaryBlacklisted = source.blacklistRows.filter(
    (row) => row.mode === "temporary",
  ).length;
  const latestInteractionAt = source.affinityRows.reduce<Date | null>(
    (latest, row) => {
      const value = row.lastInteractionAt;
      if (!value) return latest;
      if (!latest || value.getTime() > latest.getTime()) return value;
      return latest;
    },
    null,
  );

  return {
    scopeId,
    date: formatSnapshotDate(now),
    recordedAt: now,
    generatedBy: trigger,
    users: source.affinityRows.length,
    affinityTotal: source.affinityRows.reduce(
      (total, row) => total + Number(row.affinity || 0),
      0,
    ),
    longTermAffinityTotal: source.affinityRows.reduce(
      (total, row) =>
        total + Number(row.longTermAffinity ?? row.affinity ?? 0),
      0,
    ),
    shortTermAffinityTotal: source.affinityRows.reduce(
      (total, row) => total + Number(row.shortTermAffinity || 0),
      0,
    ),
    chatCount: source.affinityRows.reduce(
      (total, row) => total + Number(row.chatCount || 0),
      0,
    ),
    blacklisted: source.blacklistRows.length,
    permanentBlacklisted,
    temporaryBlacklisted,
    aliases: source.aliasRows.length,
    latestInteractionAt,
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
    nickname: row.nickname || null,
    affinity: Number(row.affinity || 0),
    longTermAffinity: Number(row.longTermAffinity ?? row.affinity ?? 0),
    shortTermAffinity: Number(row.shortTermAffinity || 0),
    chatCount: Number(row.chatCount || 0),
    relation: row.relation || null,
    specialRelation: row.specialRelation || null,
    lastInteractionAt: row.lastInteractionAt || null,
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
    trigger?: SnapshotTrigger;
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

  const snapshot = createDashboardSnapshot(
    scopeId,
    now,
    source,
    options.trigger,
  );
  const userSnapshots = createUserAffinitySnapshots(scopeId, now, source);
  // 后台会周期性采样，同一天用主键覆盖当天快照，避免趋势图出现同一日期的重复点。
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
