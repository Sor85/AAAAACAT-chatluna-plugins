/**
 * 群禁言列表变量提供者
 * 输出当前群聊中被禁言成员的统一文本列表
 */

import type { Session } from "koishi";
import {
  callOneBotAPI,
  ensureOneBotSession,
} from "../../native-tools/onebot-api";
import { resolveOneBotProtocol } from "../../native-tools/register";
import type { Config, LogFn } from "../../../types";

interface ProviderConfigurable {
  session?: Session;
}

interface NapCatShutItem {
  uin?: string | number;
  nick?: string;
  remark?: string;
  cardName?: string;
  shutUpTime?: string | number;
}

interface LlbotShutItem {
  user_id?: string | number;
  nickname?: string;
  shut_up_time?: string | number;
}

interface NormalizedShutItem {
  userId: string;
  cardName: string;
  shutUpTimeText: string;
}

export interface GroupShutListProviderDeps {
  config: Config;
  log?: LogFn;
}

function normalizeTimestamp(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "" || Number(raw) === 0)
    return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  return numeric < 1e11 ? numeric * 1000 : numeric;
}

function formatDateTime(value: number | null): string {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "未知";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function pickFirst(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function extractList(result: unknown): Array<NapCatShutItem | LlbotShutItem> {
  if (Array.isArray(result)) return result;
  if (
    result &&
    typeof result === "object" &&
    Array.isArray((result as { data?: unknown }).data)
  ) {
    return (result as { data: Array<NapCatShutItem | LlbotShutItem> }).data;
  }
  return [];
}

function normalizeShutItem(
  item: NapCatShutItem | LlbotShutItem,
): NormalizedShutItem | null {
  const userId = pickFirst(
    (item as NapCatShutItem).uin,
    (item as LlbotShutItem).user_id,
  );
  if (!userId) return null;
  const cardName = pickFirst(
    (item as NapCatShutItem).cardName,
    (item as NapCatShutItem).remark,
    (item as NapCatShutItem).nick,
    (item as LlbotShutItem).nickname,
    userId,
  );
  const shutUpTimeText = formatDateTime(
    normalizeTimestamp(
      pickFirst(
        (item as NapCatShutItem).shutUpTime,
        (item as LlbotShutItem).shut_up_time,
      ),
    ),
  );
  return {
    userId,
    cardName,
    shutUpTimeText,
  };
}

async function fetchGroupShutList(
  session: Session,
  config: Config,
): Promise<Array<NapCatShutItem | LlbotShutItem>> {
  const { error, internal } = ensureOneBotSession(session);
  if (error || !internal)
    throw new Error(error || "缺少 OneBot internal 接口。");
  const preferredProtocol = resolveOneBotProtocol(config);
  const preferredGroupId =
    preferredProtocol === "llbot"
      ? String(session.guildId)
      : Number(session.guildId);
  const fallbackGroupId =
    preferredProtocol === "llbot"
      ? Number(session.guildId)
      : String(session.guildId);

  try {
    const result = await callOneBotAPI(
      internal,
      "get_group_shut_list",
      { group_id: preferredGroupId },
      ["getGroupShutList"],
    );
    return extractList(result);
  } catch (error) {
    if (preferredGroupId === fallbackGroupId) throw error;
    const result = await callOneBotAPI(
      internal,
      "get_group_shut_list",
      { group_id: fallbackGroupId },
      ["getGroupShutList"],
    );
    return extractList(result);
  }
}

function renderShutList(items: NormalizedShutItem[]): string {
  if (items.length === 0) return "当前群暂无禁言成员。";
  return items
    .map(
      (item) =>
        `id：${item.userId}，name：${item.cardName}，禁言截至：${item.shutUpTimeText}`,
    )
    .join("\n");
}

export function createGroupShutListProvider(deps: GroupShutListProviderDeps) {
  const { config, log } = deps;

  return async (
    _args: unknown,
    _variables: unknown,
    configurable?: ProviderConfigurable,
  ): Promise<string> => {
    const session = configurable?.session;
    if (!session) return "暂无群禁言列表。";
    if (!session.guildId) return "";
    if (session.platform !== "onebot")
      return "当前平台暂不支持查询群禁言列表。";

    try {
      const list = await fetchGroupShutList(session, config);
      const normalized = list
        .map(normalizeShutItem)
        .filter(Boolean) as NormalizedShutItem[];
      return renderShutList(normalized);
    } catch (error) {
      log?.("debug", "群禁言列表变量解析失败", error);
      return "获取群禁言列表失败。";
    }
  };
}
