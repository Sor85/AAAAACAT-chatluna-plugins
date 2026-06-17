/**
 * 控制台仪表盘数据服务
 * 聚合当前 scopeId 的只读统计，供 Koishi 控制台 RPC 使用
 */

import type { Context } from "koishi";
import {
  BLACKLIST_MODEL_NAME_V2,
  MODEL_NAME_V2,
  USER_ALIAS_MODEL_NAME_V2,
} from "../../models";
import type {
  AffinityRecord,
  BlacklistRecord,
  DashboardSnapshotRecord,
  LogFn,
  RelationshipLevel,
  UserAffinitySnapshotRecord,
} from "../../types";
import {
  formatSnapshotDate,
  parseSnapshotDate,
  readRecordedDashboardSnapshots,
} from "./snapshot";

export { registerDashboardBackend } from "./backend";

export const DASHBOARD_EVENT = "chatluna-affinity/dashboard";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;
const HISTORY_POINT_LIMIT = 12;

export interface DashboardTopUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
  affinity: number;
  relation: string;
  relationTone: "custom" | "low" | "medium" | "high" | "unknown";
  chatCount: number;
  lastInteractionAt: string | null;
  historyPoints: DashboardUserHistoryPoint[];
}

export interface DashboardRelationStat {
  relation: string;
  kind: "preset" | "custom";
  count: number;
}

export interface DashboardTrendPoint {
  label: string;
  users: number;
  averageAffinity: number;
  chatCount: number;
  blacklisted: number;
}

export interface DashboardMetricChange {
  current: number;
  previous: number;
  percent: number | null;
}

export interface DashboardUserHistoryPoint {
  label: string;
  timestamp: string | null;
  affinity: number;
}

export interface DashboardBlacklistItem {
  platform: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  affinity: number | null;
  mode: "permanent" | "temporary";
  blockedAt: string | null;
  expiresAt: string | null;
  note: string;
}

export interface DashboardData {
  scopeId: string;
  generatedAt: string;
  totals: {
    users: number;
    blacklisted: number;
    permanentBlacklisted: number;
    temporaryBlacklisted: number;
    aliases: number;
    chatCount: number;
  };
  averages: {
    affinity: number;
    longTermAffinity: number;
    shortTermAffinity: number;
  };
  latestInteractionAt: string | null;
  weeklyChanges: {
    users: DashboardMetricChange;
    averageAffinity: DashboardMetricChange;
    chatCount: DashboardMetricChange;
    aliases: DashboardMetricChange;
  };
  trends: {
    week: DashboardTrendPoint[];
    month: DashboardTrendPoint[];
    all: DashboardTrendPoint[];
  };
  relationStats: DashboardRelationStat[];
  blacklistItems: DashboardBlacklistItem[];
  topUsers: DashboardTopUser[];
}

interface DashboardConsole {
  addEntry: (entry: DashboardWebuiEntry) => void;
  addListener: (
    event: string,
    callback: () => Promise<DashboardData>,
    options?: { authority?: number },
  ) => void;
}

interface DashboardRuntimeConfig {
  scopeId: string;
  debugLogging?: boolean;
  enableDashboard?: boolean;
  relationshipAffinityLevels?: RelationshipLevel[];
}

interface DashboardOptions {
  ctx: Context;
  config: DashboardRuntimeConfig;
  log: LogFn;
}

interface DashboardDataOptions {
  scopeId: string;
  relationshipAffinityLevels?: RelationshipLevel[];
  now?: Date;
}

export interface DashboardWebuiEntry {
  dev: string;
  prod: string;
}

interface DashboardWebuiOptions extends DashboardOptions {
  entry: DashboardWebuiEntry;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  // Koishi 控制台 RPC 会跨 JSON 边界，显式转成 ISO 字符串可避免前端收到 Date 对象和字符串两种形态。
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toCount(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundAverage(total: number, count: number): number {
  if (!count) return 0;
  return Math.round((total / count) * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function snapshotAffinityTotal(snapshot: DashboardSnapshotRecord): number {
  return toCount(snapshot.affinityTotal);
}

function snapshotUsers(snapshot: DashboardSnapshotRecord): number {
  return toCount(snapshot.users);
}

function snapshotChatCount(snapshot: DashboardSnapshotRecord): number {
  return toCount(snapshot.chatCount);
}

function snapshotBlacklisted(snapshot: DashboardSnapshotRecord): number {
  return toCount(snapshot.blacklisted);
}

function snapshotAliases(snapshot: DashboardSnapshotRecord): number {
  return toCount(snapshot.aliases);
}

function createMetricChange(
  current: number,
  previous: number,
): DashboardMetricChange {
  return {
    current,
    previous,
    percent:
      previous === 0
        ? current === 0
          ? 0
          : null
        : roundPercent(((current - previous) / previous) * 100),
  };
}

function getDisplayRelation(record: AffinityRecord): string {
  return record.specialRelation || record.relation || "未分组";
}

function getRelationKind(record: AffinityRecord): DashboardRelationStat["kind"] {
  return record.specialRelation ? "custom" : "preset";
}

function getRelationTone(
  record: AffinityRecord,
  levels: RelationshipLevel[] | undefined,
): DashboardTopUser["relationTone"] {
  if (record.specialRelation) return "custom";

  const relation = record.relation || "";
  const orderedLevels = [...(levels || [])]
    .filter((level) => level.relation)
    .sort((left, right) => left.min - right.min);
  const index = orderedLevels.findIndex((level) => level.relation === relation);
  if (index < 0) return "unknown";

  const ratio =
    orderedLevels.length > 1 ? index / (orderedLevels.length - 1) : 1;
  if (ratio <= 0.25) return "low";
  if (ratio < 0.75) return "medium";
  return "high";
}

function getDisplayName(record: AffinityRecord): string {
  return record.nickname || record.userId;
}

function getOneBotAvatarUrl(userId: string): string | null {
  const numericId = userId.match(/^\d+$/)?.[0];
  return numericId
    ? `https://q1.qlogo.cn/g?b=qq&nk=${numericId}&s=640`
    : null;
}

function getBlacklistDisplayName(record: BlacklistRecord): string {
  return record.nickname || record.userId;
}

function formatTrendLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function createEmptyTrendPoint(date: Date): DashboardTrendPoint {
  return {
    label: formatTrendLabel(date),
    users: 0,
    averageAffinity: 0,
    chatCount: 0,
    blacklisted: 0,
  };
}

function createSnapshotTrendPoint(
  snapshot: DashboardSnapshotRecord,
): DashboardTrendPoint | null {
  const date = parseSnapshotDate(snapshot.date);
  if (!date) return null;

  return {
    label: formatTrendLabel(date),
    users: snapshotUsers(snapshot),
    averageAffinity: roundAverage(
      snapshotAffinityTotal(snapshot),
      snapshotUsers(snapshot),
    ),
    chatCount: snapshotChatCount(snapshot),
    blacklisted: snapshotBlacklisted(snapshot),
  };
}

function createDailyTrend(
  snapshots: DashboardSnapshotRecord[],
  anchor: Date,
  days: number,
): DashboardTrendPoint[] {
  const snapshotsByDate = new Map(
    snapshots.map((snapshot) => [snapshot.date, snapshot]),
  );
  const end = startOfLocalDay(anchor).getTime() + DAY_MS;
  const start = new Date(end - days * DAY_MS);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    const snapshot = snapshotsByDate.get(formatSnapshotDate(date));
    const point = snapshot ? createSnapshotTrendPoint(snapshot) : null;
    return point || createEmptyTrendPoint(date);
  });
}

function createAllTrend(
  snapshots: DashboardSnapshotRecord[],
): DashboardTrendPoint[] {
  const latestByMonth = new Map<string, DashboardSnapshotRecord>();

  for (const snapshot of snapshots) {
    const date = parseSnapshotDate(snapshot.date);
    if (!date) continue;

    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = latestByMonth.get(key);
    if (!current || snapshot.date > current.date) {
      latestByMonth.set(key, snapshot);
    }
  }

  return [...latestByMonth.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, snapshot]) => {
      const point = createSnapshotTrendPoint(snapshot);
      const date = parseSnapshotDate(snapshot.date);
      return {
        ...(point || createEmptyTrendPoint(date || new Date())),
        label: date
          ? `${date.getFullYear()}/${date.getMonth() + 1}`
          : snapshot.date,
      };
    });
}

function getSnapshotTime(snapshot: DashboardSnapshotRecord): number | null {
  return parseSnapshotDate(snapshot.date)?.getTime() ?? null;
}

function getLatestSnapshotDate(
  snapshots: DashboardSnapshotRecord[],
): Date | null {
  const times = snapshots
    .map(getSnapshotTime)
    .filter((value): value is number => value !== null);

  if (!times.length) return null;
  return new Date(Math.max(...times));
}

function findLatestSnapshotInWindow(
  snapshots: DashboardSnapshotRecord[],
  start: number,
  end: number,
): DashboardSnapshotRecord | null {
  let latest: DashboardSnapshotRecord | null = null;
  let latestTime = -Infinity;

  for (const snapshot of snapshots) {
    const time = getSnapshotTime(snapshot);
    if (time === null || time < start || time >= end || time < latestTime) {
      continue;
    }
    latest = snapshot;
    latestTime = time;
  }

  return latest;
}

function snapshotAverage(snapshot: DashboardSnapshotRecord | null): number {
  if (!snapshot) return 0;
  return roundAverage(snapshotAffinityTotal(snapshot), snapshotUsers(snapshot));
}

function createUserHistoryPoints(
  row: AffinityRecord,
  snapshots: UserAffinitySnapshotRecord[],
): DashboardUserHistoryPoint[] {
  const points = snapshots
    .map((snapshot) => {
      const date = parseSnapshotDate(snapshot.date);
      if (!date) return null;
      return {
        label: formatTrendLabel(date),
        timestamp: toIsoString(snapshot.recordedAt) || toIsoString(date),
        affinity: toCount(snapshot.affinity),
      };
    })
    .filter((point): point is DashboardUserHistoryPoint => point !== null)
    .sort((left, right) =>
      String(left.timestamp).localeCompare(String(right.timestamp)),
    )
    .slice(-HISTORY_POINT_LIMIT);

  if (points.length) {
    return points;
  }

  return [
    {
      label: "当前",
      timestamp: toIsoString(row.lastInteractionAt),
      affinity: toCount(row.affinity),
    },
  ];
}

function groupUserSnapshots(
  snapshots: UserAffinitySnapshotRecord[],
): Map<string, UserAffinitySnapshotRecord[]> {
  const grouped = new Map<string, UserAffinitySnapshotRecord[]>();
  for (const snapshot of snapshots) {
    const rows = grouped.get(snapshot.userId) || [];
    rows.push(snapshot);
    grouped.set(snapshot.userId, rows);
  }
  return grouped;
}

export async function getDashboardData(
  ctx: Context,
  options: DashboardDataOptions,
): Promise<DashboardData> {
  const scopeId = options.scopeId;
  const now = options.now || new Date();
  const relationshipAffinityLevels = options.relationshipAffinityLevels || [];
  const affinityRows = await ctx.database.get(MODEL_NAME_V2, {
    scopeId,
  });
  const blacklistRows = await ctx.database.get(BLACKLIST_MODEL_NAME_V2, {
    scopeId,
  });
  const aliasRows = await ctx.database.get(USER_ALIAS_MODEL_NAME_V2, {
    scopeId,
  });
  const recordedSnapshots = await readRecordedDashboardSnapshots(ctx, scopeId);
  const snapshotRows = recordedSnapshots.dashboardSnapshots;
  const userSnapshotRows = recordedSnapshots.userAffinitySnapshots;
  const trendAnchor = getLatestSnapshotDate(snapshotRows) || now;

  let chatCount = 0;
  let affinityTotal = 0;
  let longTermTotal = 0;
  let shortTermTotal = 0;
  let latestInteractionAt: string | null = null;
  const relationCounts = new Map<string, DashboardRelationStat>();
  const affinityByUserId = new Map<string, number>();
  const userSnapshotsByUserId = groupUserSnapshots(userSnapshotRows);

  for (const row of affinityRows) {
    chatCount += toCount(row.chatCount);
    affinityTotal += toCount(row.affinity);
    longTermTotal += toCount(row.longTermAffinity ?? row.affinity);
    shortTermTotal += toCount(row.shortTermAffinity);

    const relation = getDisplayRelation(row);
    const kind = getRelationKind(row);
    const relationKey = `${kind}:${relation}`;
    const currentRelation = relationCounts.get(relationKey) || {
      relation,
      kind,
      count: 0,
    };
    currentRelation.count += 1;
    relationCounts.set(relationKey, currentRelation);
    affinityByUserId.set(row.userId, toCount(row.affinity));

    const currentInteractionAt = toIsoString(row.lastInteractionAt);
    if (
      currentInteractionAt &&
      (!latestInteractionAt || currentInteractionAt > latestInteractionAt)
    ) {
      latestInteractionAt = currentInteractionAt;
    }
  }

  const topUsers = [...affinityRows]
    .sort((left, right) => right.affinity - left.affinity)
    .map((row) => ({
      userId: row.userId,
      name: getDisplayName(row),
      avatarUrl: getOneBotAvatarUrl(row.userId),
      affinity: toCount(row.affinity),
      relation: getDisplayRelation(row),
      relationTone: getRelationTone(row, relationshipAffinityLevels),
      chatCount: toCount(row.chatCount),
      lastInteractionAt: toIsoString(row.lastInteractionAt),
      historyPoints: createUserHistoryPoints(
        row,
        userSnapshotsByUserId.get(row.userId) || [],
      ),
    }));

  const relationStats = [...relationCounts.values()]
    .sort((left, right) => right.count - left.count);

  const currentWeekEnd = startOfLocalDay(trendAnchor).getTime() + DAY_MS;
  const currentWeekStart = currentWeekEnd - WEEK_DAYS * DAY_MS;
  const previousWeekStart = currentWeekStart - WEEK_DAYS * DAY_MS;
  const currentWeekSnapshot = findLatestSnapshotInWindow(
    snapshotRows,
    currentWeekStart,
    currentWeekEnd,
  );
  const previousWeekSnapshot = findLatestSnapshotInWindow(
    snapshotRows,
    previousWeekStart,
    currentWeekStart,
  );

  const blacklistItems = [...blacklistRows]
    .sort((left, right) => {
      const leftTime = toIsoString(left.blockedAt) || "";
      const rightTime = toIsoString(right.blockedAt) || "";
      return rightTime.localeCompare(leftTime);
    })
    .map((row) => ({
      platform: row.platform,
      userId: row.userId,
      name: getBlacklistDisplayName(row),
      avatarUrl: getOneBotAvatarUrl(row.userId),
      affinity: affinityByUserId.get(row.userId) ?? null,
      mode: row.mode,
      blockedAt: toIsoString(row.blockedAt),
      expiresAt: toIsoString(row.expiresAt),
      note: row.note || "",
    }));

  const permanentBlacklisted = blacklistRows.filter(
    (row) => row.mode === "permanent",
  ).length;
  const temporaryBlacklisted = blacklistRows.filter(
    (row) => row.mode === "temporary",
  ).length;

  return {
    scopeId,
    generatedAt: new Date().toISOString(),
    totals: {
      users: affinityRows.length,
      blacklisted: blacklistRows.length,
      permanentBlacklisted,
      temporaryBlacklisted,
      aliases: aliasRows.length,
      chatCount,
    },
    averages: {
      affinity: roundAverage(affinityTotal, affinityRows.length),
      longTermAffinity: roundAverage(longTermTotal, affinityRows.length),
      shortTermAffinity: roundAverage(shortTermTotal, affinityRows.length),
    },
    latestInteractionAt,
    weeklyChanges: {
      users: createMetricChange(
        currentWeekSnapshot ? snapshotUsers(currentWeekSnapshot) : 0,
        previousWeekSnapshot ? snapshotUsers(previousWeekSnapshot) : 0,
      ),
      averageAffinity: createMetricChange(
        snapshotAverage(currentWeekSnapshot),
        snapshotAverage(previousWeekSnapshot),
      ),
      chatCount: createMetricChange(
        currentWeekSnapshot ? snapshotChatCount(currentWeekSnapshot) : 0,
        previousWeekSnapshot ? snapshotChatCount(previousWeekSnapshot) : 0,
      ),
      aliases: createMetricChange(
        currentWeekSnapshot ? snapshotAliases(currentWeekSnapshot) : 0,
        previousWeekSnapshot ? snapshotAliases(previousWeekSnapshot) : 0,
      ),
    },
    trends: {
      week: createDailyTrend(snapshotRows, trendAnchor, WEEK_DAYS),
      month: createDailyTrend(snapshotRows, trendAnchor, MONTH_DAYS),
      all: createAllTrend(snapshotRows),
    },
    relationStats,
    blacklistItems,
    topUsers,
  };
}

export function registerDashboardWebui(options: DashboardWebuiOptions): void {
  const { config, ctx, entry, log } = options;
  if (config.enableDashboard === false) return;

  ctx.inject(["console"], (innerCtx) => {
    // Koishi 的 console 是可选 service；用 inject 等待它可用，避免加载顺序变化时侧栏 entry 没注册。
    const consoleService = (innerCtx as Context & { console: DashboardConsole })
      .console;

    consoleService.addEntry(entry);
    consoleService.addListener(
      DASHBOARD_EVENT,
      async () =>
        getDashboardData(ctx, {
          scopeId: config.scopeId,
          relationshipAffinityLevels: config.relationshipAffinityLevels,
        }),
      { authority: 1 },
    );

    if (config.debugLogging) {
      log("debug", "已注册控制台仪表盘页面与数据接口", {
        event: DASHBOARD_EVENT,
        scopeId: config.scopeId,
      });
    }
  });
}
