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
import type { AffinityRecord, LogFn } from "../../types";

export const DASHBOARD_EVENT = "chatluna-affinity/dashboard";

export interface DashboardTopUser {
  userId: string;
  name: string;
  affinity: number;
  relation: string;
  chatCount: number;
  lastInteractionAt: string | null;
}

export interface DashboardRelationStat {
  relation: string;
  count: number;
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
  relationStats: DashboardRelationStat[];
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
}

interface DashboardOptions {
  ctx: Context;
  config: DashboardRuntimeConfig;
  log: LogFn;
}

interface DashboardDataOptions {
  scopeId: string;
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

function getDisplayRelation(record: AffinityRecord): string {
  return record.specialRelation || record.relation || "未分组";
}

function getDisplayName(record: AffinityRecord): string {
  return record.nickname || record.userId;
}

export async function getDashboardData(
  ctx: Context,
  options: DashboardDataOptions,
): Promise<DashboardData> {
  const scopeId = options.scopeId;
  const affinityRows = await ctx.database.get(MODEL_NAME_V2, {
    scopeId,
  });
  const blacklistRows = await ctx.database.get(BLACKLIST_MODEL_NAME_V2, {
    scopeId,
  });
  const aliasRows = await ctx.database.get(USER_ALIAS_MODEL_NAME_V2, {
    scopeId,
  });

  let chatCount = 0;
  let affinityTotal = 0;
  let longTermTotal = 0;
  let shortTermTotal = 0;
  let latestInteractionAt: string | null = null;
  const relationCounts = new Map<string, number>();

  for (const row of affinityRows) {
    chatCount += toCount(row.chatCount);
    affinityTotal += toCount(row.affinity);
    longTermTotal += toCount(row.longTermAffinity ?? row.affinity);
    shortTermTotal += toCount(row.shortTermAffinity);

    const relation = getDisplayRelation(row);
    relationCounts.set(relation, (relationCounts.get(relation) || 0) + 1);

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
    .slice(0, 10)
    .map((row) => ({
      userId: row.userId,
      name: getDisplayName(row),
      affinity: toCount(row.affinity),
      relation: getDisplayRelation(row),
      chatCount: toCount(row.chatCount),
      lastInteractionAt: toIsoString(row.lastInteractionAt),
    }));

  const relationStats = [...relationCounts.entries()]
    .map(([relation, count]) => ({ relation, count }))
    .sort((left, right) => right.count - left.count);

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
    relationStats,
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
      async () => getDashboardData(ctx, { scopeId: config.scopeId }),
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
