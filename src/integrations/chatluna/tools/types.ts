/**
 * ChatLuna 工具类型定义
 * 定义工具依赖和通用接口
 */

import type { Session } from "koishi";
import type { Config, AffinityCache, RelationshipLevel } from "../../../types";
import type { AffinityStore } from "../../../services/affinity/store";
import type { BlacklistService } from "../../../services/blacklist/repository";

export interface ToolRunnable {
  configurable?: { session?: Session };
}

export interface ToolDependencies {
  config: Config;
  store: AffinityStore;
  cache: AffinityCache;
  blacklist: BlacklistService;
  clamp: (value: number) => number;
  resolveLevelByAffinity: (value: number) => RelationshipLevel | null;
  resolveLevelByRelation: (name: string) => RelationshipLevel | null;
  resolveUserIdentity: (
    session: Session,
    input: string,
  ) => Promise<{ userId: string; nickname: string } | null>;
}

export function getSession(runnable: unknown): Session | null {
  return (runnable as ToolRunnable)?.configurable?.session || null;
}
