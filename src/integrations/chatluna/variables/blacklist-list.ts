/**
 * 黑名单列表变量提供者
 * 为 ChatLuna 提供当前群黑名单列表信息
 */

import type { Session } from "koishi";
import type { AffinityStore } from "../../../services/affinity/store";
import type { BlacklistService } from "../../../services/blacklist/repository";
import { fetchGroupMemberIds, resolveGroupId } from "../../../helpers/member";

interface ProviderConfigurable {
  session?: Session;
}

export interface BlacklistListProviderDeps {
  store: AffinityStore;
  blacklist: BlacklistService;
}

type BlacklistItem = {
  userId: string;
  nickname?: string;
  blockedAt: string;
  mode: "permanent" | "temporary";
  expiresAt?: string;
};

export function createBlacklistListProvider(deps: BlacklistListProviderDeps) {
  const { store, blacklist } = deps;

  return async (
    _args: unknown[] | undefined,
    _variables: unknown,
    configurable?: ProviderConfigurable,
  ): Promise<string> => {
    const session = configurable?.session;
    const platform = session?.platform;
    const selfId = session?.selfId;
    if (!session || !platform || !selfId) return "";

    const groupId = resolveGroupId(session);
    if (!groupId) return "";

    const memberIds = await fetchGroupMemberIds(session);
    const members = memberIds || new Set<string>();
    const permanentRecords = await blacklist.listPermanent(platform);
    const temporaryRecords = await blacklist.listTemporary(platform);

    const records: BlacklistItem[] = [
      ...permanentRecords.map((entry) => ({
        userId: entry.userId,
        nickname: entry.nickname,
        blockedAt: entry.blockedAt,
        mode: "permanent" as const,
      })),
      ...temporaryRecords.map((entry) => ({
        userId: entry.userId,
        nickname: entry.nickname,
        blockedAt: entry.blockedAt,
        expiresAt: entry.expiresAt,
        mode: "temporary" as const,
      })),
    ];

    if (!records.length) return "";

    const rows: string[] = [];
    for (const entry of records) {
      if (!entry?.userId) continue;
      if (members.size > 0 && !members.has(entry.userId)) continue;

      const record = await store.load(selfId, entry.userId);
      const name = record?.nickname || entry.nickname || entry.userId;
      const affinity = Number(record?.affinity ?? 0);

      if (entry.mode === "temporary") {
        rows.push(
          `name:${name} | id:${entry.userId} | affinity:${affinity} | mode:temporary | blockedAt:${entry.blockedAt} | expiresAt:${entry.expiresAt || ""}`,
        );
        continue;
      }

      rows.push(
        `name:${name} | id:${entry.userId} | affinity:${affinity} | mode:permanent | blockedAt:${entry.blockedAt}`,
      );
    }

    return rows.join("\n");
  };
}

export type BlacklistListProvider = ReturnType<
  typeof createBlacklistListProvider
>;
