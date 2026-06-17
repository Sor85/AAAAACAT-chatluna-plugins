/**
 * 模板排除与 key 过滤
 * 提供 key 级别的归一化与排除能力
 */

import type { Config } from "../../config";

export function normalizeMemeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeGroupId(value: unknown): string {
  return String(value ?? "").trim();
}

type RecordLike = Record<string, unknown>;

function isRecordLike(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

function getField(source: unknown, key: string): unknown {
  if (!isRecordLike(source)) return undefined;
  return source[key];
}

function getNestedId(source: unknown, key: string): unknown {
  return getField(getField(source, key), "id");
}

const RAW_EVENT_FIELD_NAMES = ["message", "raw", "_data", "original"];

function collectEventGroupIdCandidates(event: unknown): unknown[] {
  const candidates = [
    getNestedId(event, "guild"),
    getNestedId(event, "group"),
    getField(event, "guildId"),
    getField(event, "guild_id"),
    getField(event, "groupId"),
    getField(event, "group_id"),
  ];

  for (const fieldName of RAW_EVENT_FIELD_NAMES) {
    const rawEvent = getField(event, fieldName);
    const rawPayloadData = getField(rawEvent, "d");
    candidates.push(
      getNestedId(rawEvent, "guild"),
      getNestedId(rawEvent, "group"),
      getField(rawEvent, "guildId"),
      getField(rawEvent, "guild_id"),
      getField(rawEvent, "groupId"),
      getField(rawEvent, "group_id"),
      getNestedId(rawPayloadData, "guild"),
      getNestedId(rawPayloadData, "group"),
      getField(rawPayloadData, "guildId"),
      getField(rawPayloadData, "guild_id"),
      getField(rawPayloadData, "groupId"),
      getField(rawPayloadData, "group_id"),
    );
  }

  return candidates;
}

function resolveEventMessageType(event: unknown): string {
  const candidates = [
    getField(event, "message_type"),
    getField(event, "messageType"),
  ];

  for (const fieldName of RAW_EVENT_FIELD_NAMES) {
    const rawEvent = getField(event, fieldName);
    const rawPayloadData = getField(rawEvent, "d");
    candidates.push(
      getField(rawEvent, "message_type"),
      getField(rawEvent, "messageType"),
      getField(rawPayloadData, "message_type"),
      getField(rawPayloadData, "messageType"),
    );
  }

  for (const candidate of candidates) {
    const messageType = normalizeGroupId(candidate);
    if (messageType) return messageType;
  }

  return "";
}

export function resolveSessionGroupId(session: unknown): string {
  if (!isRecordLike(session)) return "";

  const event = getField(session, "event");
  const messageType = resolveEventMessageType(event);

  // Koishi/Satori 常用 guildId；OneBot 适配器可能只把真实 QQ 群号留在原始 group_id。
  // 分群屏蔽按用户填写的 QQ 群号匹配，必须先读这些协议字段，再退回 channelId。
  const candidates = [
    getField(session, "guildId"),
    getField(session, "groupId"),
    ...collectEventGroupIdCandidates(event),
    messageType === "group" ? getField(session, "channelId") : "",
    messageType === "group" ? getNestedId(event, "channel") : "",
  ];

  for (const candidate of candidates) {
    const groupId = normalizeGroupId(candidate);
    if (groupId && groupId !== "private") return groupId;
  }

  return "";
}

export function buildExcludedMemeKeySet(config: Config): Set<string> {
  return new Set(
    config.excludedMemeKeys
      .map((key) => normalizeMemeKey(key))
      .filter((key) => key.length > 0),
  );
}

export function buildGroupExcludedMemeKeySets(
  config: Config,
): Map<string, Set<string>> {
  const groupExcludedSets = new Map<string, Set<string>>();

  for (const rule of config.groupExcludedMemeKeys ?? []) {
    const groupId = normalizeGroupId(rule.groupId);
    if (!groupId) continue;

    const excludedSet = groupExcludedSets.get(groupId) ?? new Set<string>();
    for (const key of rule.excludedMemeKeys) {
      const normalizedKey = normalizeMemeKey(key);
      if (normalizedKey) excludedSet.add(normalizedKey);
    }
    groupExcludedSets.set(groupId, excludedSet);
  }

  return groupExcludedSets;
}

export function isExcludedMemeKey(
  key: string,
  excludedKeySet: Set<string>,
): boolean {
  return excludedKeySet.has(normalizeMemeKey(key));
}

export function filterExcludedMemeKeys(
  keys: string[],
  excludedKeySet: Set<string>,
): string[] {
  return keys.filter((key) => !isExcludedMemeKey(key, excludedKeySet));
}
