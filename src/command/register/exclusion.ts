/**
 * 模板排除与 key 过滤
 * 提供 key 级别的归一化与排除能力
 */

import type { Config } from "../../config";

export function normalizeMemeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function buildExcludedMemeKeySet(config: Config): Set<string> {
  return new Set(
    config.excludedMemeKeys
      .map((key) => normalizeMemeKey(key))
      .filter((key) => key.length > 0),
  );
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
