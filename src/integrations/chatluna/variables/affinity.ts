/**
 * 好感度变量提供者
 * 为 ChatLuna 提供当前用户及上下文用户好感度变量
 */

import type { Session } from "koishi";
import type { Config, AffinityCache } from "../../../types";
import type { AffinityStore } from "../../../services/affinity/store";
import type { HistoryEntry } from "../../../services/message/history";
import { isValidScopeId, resolveScopedVariableArgs } from "../../../helpers";

interface AffinityVariableRow {
  userId: string;
  name: string;
  nickname: string;
  affinity: number;
  relationship: string;
}

interface ProviderConfigurable {
  session?: Session;
}

export interface AffinityProviderDeps {
  config: Config;
  cache: AffinityCache;
  store: AffinityStore;
  fetchEntries?: (session: Session, count: number) => Promise<HistoryEntry[]>;
  getUserAlias?: (
    scopeId: string,
    platform: string,
    userId: string,
  ) => Promise<string | null>;
}

export function createAffinityProvider(deps: AffinityProviderDeps) {
  const { config, cache, store, fetchEntries, getUserAlias } = deps;

  const resolveRelationByAffinity = (affinity: number): string => {
    const level = (config.relationshipAffinityLevels || []).find(
      (item) => affinity >= item.min && affinity <= item.max,
    );
    return level?.relation || "未知";
  };

  const resolveNickname = async (
    scopeId: string,
    platform: string,
    userId: string,
  ): Promise<string> => {
    const nickname = await getUserAlias?.(scopeId, platform, userId);
    return String(nickname || "").trim();
  };

  const formatRow = (row: AffinityVariableRow): string => {
    const parts = [
      `id:${row.userId}`,
      `name:${row.name}`,
      row.nickname ? `nickname:${row.nickname}` : "",
      `affinity:${row.affinity}`,
      `relationship:${row.relationship}`,
    ].filter(Boolean);
    return parts.join(" ");
  };

  return async (
    args: unknown[] | undefined,
    _variables: unknown,
    configurable?: ProviderConfigurable,
  ): Promise<number | string> => {
    const session = configurable?.session;
    if (!session?.platform || !session?.userId) {
      return "";
    }

    const resolved = resolveScopedVariableArgs(args);
    const scopeId = resolved?.scopeId;
    if (!scopeId || !isValidScopeId(scopeId)) return "";

    const platform = session.platform;
    const targetUserId = resolved?.targetUserId || session.userId;
    const cached = cache.get(scopeId, targetUserId);
    if (cached !== null && (config.affinityDisplayRange ?? 1) <= 1) {
      const cachedNickname = await resolveNickname(
        scopeId,
        platform,
        targetUserId,
      );
      return formatRow({
        userId: targetUserId,
        name: targetUserId,
        nickname: cachedNickname,
        affinity: cached,
        relationship: resolveRelationByAffinity(cached),
      });
    }

    const currentRecord = await store.load(scopeId, targetUserId);
    const currentAffinity = currentRecord?.affinity ?? store.defaultInitial();
    const currentRelation =
      currentRecord?.specialRelation ||
      currentRecord?.relation ||
      resolveRelationByAffinity(currentAffinity);
    const currentName = currentRecord?.nickname || targetUserId;
    const currentNickname = await resolveNickname(
      scopeId,
      platform,
      targetUserId,
    );
    cache.set(scopeId, targetUserId, currentAffinity);

    const displayRange = Math.max(
      1,
      Math.floor(config.affinityDisplayRange ?? 1),
    );
    if (displayRange <= 1) {
      return formatRow({
        userId: targetUserId,
        name: currentName,
        nickname: currentNickname,
        affinity: currentAffinity,
        relationship: currentRelation,
      });
    }
    if (typeof fetchEntries !== "function") {
      return formatRow({
        userId: targetUserId,
        name: currentName,
        nickname: currentNickname,
        affinity: currentAffinity,
        relationship: currentRelation,
      });
    }

    const entries = await fetchEntries(session, Math.max(1, displayRange * 10));
    const orderedUsers: { userId: string; username: string }[] = [];
    const seen = new Set<string>([targetUserId]);

    for (const entry of entries) {
      const userId = entry.userId;
      if (!userId || userId === session.selfId) continue;
      if (seen.has(userId)) continue;
      seen.add(userId);
      orderedUsers.push({
        userId,
        username: entry.username || userId,
      });
      if (orderedUsers.length >= displayRange - 1) break;
    }

    const rows: string[] = [];
    rows.push(
      formatRow({
        userId: targetUserId,
        name: currentName,
        nickname: currentNickname,
        affinity: currentAffinity,
        relationship: currentRelation,
      }),
    );

    if (!orderedUsers.length) return rows.join("\n");

    const others = await Promise.all(
      orderedUsers.map(async ({ userId, username }) => {
        const record = await store.load(scopeId, userId);
        const affinity = record?.affinity ?? store.defaultInitial();
        const relation =
          record?.specialRelation ||
          record?.relation ||
          resolveRelationByAffinity(affinity);
        const name = username || record?.nickname || userId;
        const nickname = await resolveNickname(scopeId, platform, userId);
        return formatRow({
          userId,
          name,
          nickname,
          affinity,
          relationship: relation,
        });
      }),
    );

    rows.push(...(others.filter(Boolean) as string[]));
    return rows.join("\n");
  };
}

export type AffinityProvider = ReturnType<typeof createAffinityProvider>;
