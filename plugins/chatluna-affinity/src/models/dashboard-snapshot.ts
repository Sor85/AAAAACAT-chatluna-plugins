/**
 * 仪表盘日级快照表定义
 */

import type { Context } from "koishi";
import type {
  DashboardSnapshotRecord,
  UserAffinitySnapshotRecord,
} from "../types";

export const DASHBOARD_SNAPSHOT_MODEL_NAME =
  "chatluna_affinity_dashboard_snapshot";
export const USER_AFFINITY_SNAPSHOT_MODEL_NAME =
  "chatluna_affinity_user_snapshot";

declare module "koishi" {
  interface Tables {
    [DASHBOARD_SNAPSHOT_MODEL_NAME]: DashboardSnapshotRecord;
    [USER_AFFINITY_SNAPSHOT_MODEL_NAME]: UserAffinitySnapshotRecord;
  }
}

export function extendDashboardSnapshotModel(ctx: Context): void {
  ctx.model.extend(
    DASHBOARD_SNAPSHOT_MODEL_NAME,
    {
      scopeId: { type: "string", length: 32 },
      date: { type: "string", length: 10 },
      recordedAt: { type: "timestamp" },
      users: { type: "integer", initial: 0 },
      affinityTotal: { type: "integer", initial: 0 },
      chatCount: { type: "integer", initial: 0 },
      blacklisted: { type: "integer", initial: 0 },
      aliases: { type: "integer", initial: 0 },
    },
    { primary: ["scopeId", "date"] },
  );

  ctx.model.extend(
    USER_AFFINITY_SNAPSHOT_MODEL_NAME,
    {
      scopeId: { type: "string", length: 32 },
      userId: { type: "string", length: 64 },
      date: { type: "string", length: 10 },
      recordedAt: { type: "timestamp" },
      affinity: { type: "integer", initial: 0 },
    },
    { primary: ["scopeId", "userId", "date"] },
  );
}
