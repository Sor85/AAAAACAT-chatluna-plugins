/**
 * 随机命令辅助逻辑
 * 提供模板打散、分桶与候选随机选择能力
 */

import type {
  RandomMemeBucketCategory,
  RandomMemeBucketWeightRule,
} from "../config";
import type { MemeParamsType } from "../types";

export interface RandomMemeCandidateBase {
  key: string;
}

export interface RandomMemeBucketChoice<T> {
  bucketCategory: RandomMemeBucketCategory;
  candidates: T[];
}

function getBucketRuleWeight(rule: RandomMemeBucketWeightRule): number {
  if (!rule.enabled) return 0;
  if (!Number.isFinite(rule.weight)) return 0;
  return Math.max(0, rule.weight);
}

export function resolveRandomMemeBucket(
  params: MemeParamsType | undefined,
): RandomMemeBucketCategory {
  if (!params) return "other";

  const needImage = params.max_images > 0;
  const needText = params.max_texts > 0;

  if (!needImage && needText) return "text-only";
  if (needImage && needText) return "image-and-text";

  if (needImage && !needText) {
    const isSingleImageOnly = params.min_images === 1 && params.max_images === 1;
    if (isSingleImageOnly) return "single-image-only";

    const isTwoImageOnly = params.min_images === 2 && params.max_images === 2;
    if (isTwoImageOnly) return "two-image-only";
  }

  return "other";
}

function groupCandidatesByBucket<T extends { bucketCategory: RandomMemeBucketCategory }>(
  candidates: T[],
): Map<RandomMemeBucketCategory, T[]> {
  const grouped = new Map<RandomMemeBucketCategory, T[]>();

  for (const candidate of candidates) {
    const bucketCandidates = grouped.get(candidate.bucketCategory) ?? [];
    grouped.set(candidate.bucketCategory, [...bucketCandidates, candidate]);
  }

  return grouped;
}

export function pickRandomBucketByWeight<
  T extends { bucketCategory: RandomMemeBucketCategory },
>(
  candidates: T[],
  rules: RandomMemeBucketWeightRule[],
): RandomMemeBucketChoice<T> | undefined {
  if (candidates.length === 0) return undefined;

  const grouped = groupCandidatesByBucket(candidates);
  const weightedBuckets = rules
    .map((rule) => ({
      category: rule.category,
      weight: getBucketRuleWeight(rule),
      candidates: grouped.get(rule.category) ?? [],
    }))
    .filter((item) => item.weight > 0 && item.candidates.length > 0);

  if (weightedBuckets.length === 0) return undefined;

  const totalWeight = weightedBuckets.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  const randomValue = Math.random() * totalWeight;

  let accumulated = 0;
  for (const item of weightedBuckets) {
    accumulated += item.weight;
    if (randomValue < accumulated) {
      return {
        bucketCategory: item.category,
        candidates: item.candidates,
      };
    }
  }

  const fallback = weightedBuckets[weightedBuckets.length - 1];
  if (!fallback) return undefined;
  return {
    bucketCategory: fallback.category,
    candidates: fallback.candidates,
  };
}

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
