/**
 * 随机命令辅助逻辑
 * 提供模板打散与候选随机选择能力
 */

export function createShuffledKeys(keys: string[]): string[] {
  return keys
    .map((item) => item.trim())
    .filter(Boolean)
    .map((key) => ({ key, seed: Math.random() }))
    .sort((a, b) => a.seed - b.seed)
    .map((item) => item.key);
}

export function pickRandomItem<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

interface RandomDedupeConfig {
  enabled: boolean;
  windowHours: number;
  nowMs?: number;
}

function resolveWindowHours(windowHours: number): number {
  if (!Number.isFinite(windowHours) || windowHours <= 0) return 24;
  return windowHours;
}

function resolveNowMs(nowMs?: number): number {
  if (typeof nowMs === "number" && Number.isFinite(nowMs)) return nowMs;
  return Date.now();
}

function pruneHistory(
  history: ReadonlyMap<string, number>,
  config: RandomDedupeConfig,
): Map<string, number> {
  const nextHistory = new Map(history);
  if (!config.enabled) return nextHistory;

  const nowMs = resolveNowMs(config.nowMs);
  const windowMs = resolveWindowHours(config.windowHours) * 60 * 60 * 1000;

  for (const [key, timestamp] of nextHistory.entries()) {
    if (nowMs - timestamp >= windowMs) {
      nextHistory.delete(key);
    }
  }

  return nextHistory;
}

export function getRandomCandidatesWithDedupe<T extends { key: string }>(
  items: T[],
  history: ReadonlyMap<string, number>,
  config: RandomDedupeConfig,
): { candidates: T[]; history: Map<string, number> } {
  const nextHistory = pruneHistory(history, config);
  if (!config.enabled) {
    return { candidates: items, history: nextHistory };
  }

  const dedupedCandidates = items.filter((item) => !nextHistory.has(item.key));
  return { candidates: dedupedCandidates, history: nextHistory };
}

export function recordRandomSelection(
  history: ReadonlyMap<string, number>,
  key: string,
  config: RandomDedupeConfig,
): Map<string, number> {
  const nextHistory = pruneHistory(history, config);
  if (!config.enabled || !key.trim()) {
    return nextHistory;
  }

  const nowMs = resolveNowMs(config.nowMs);
  return new Map(nextHistory).set(key, nowMs);
}
