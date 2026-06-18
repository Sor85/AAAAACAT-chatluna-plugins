import type { Context } from "koishi";
import type { LogFn } from "../../types";
import { recordDashboardSnapshot } from "./snapshot";

const DEFAULT_SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000;

interface DashboardBackendConfig {
  scopeId: string;
  enableDashboard?: boolean;
}

export interface DashboardBackendOptions {
  ctx: Context;
  config: DashboardBackendConfig;
  log: LogFn;
  now?: () => Date;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  sampleIntervalMs?: number;
}

export function registerDashboardBackend(options: DashboardBackendOptions): void {
  const { config, ctx, log } = options;
  if (config.enableDashboard === false) return;

  const getNow = options.now || (() => new Date());
  const intervalMs = options.sampleIntervalMs || DEFAULT_SNAPSHOT_INTERVAL_MS;
  const schedule = options.setInterval || setInterval;
  const clear = options.clearInterval || clearInterval;
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  const record = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await recordDashboardSnapshot(ctx, {
        scopeId: config.scopeId,
        now: getNow(),
      });
    } catch (error) {
      log("warn", "记录仪表盘后台快照失败", error);
    } finally {
      running = false;
    }
  };

  ctx.on("ready", () => {
    if (timer !== null) return;
    // 仪表盘页面请求不能是唯一采样入口；后台采样保证无人打开页面时也能留下日级历史。
    void record();
    timer = schedule(() => {
      void record();
    }, intervalMs);
  });

  ctx.on("dispose", () => {
    if (timer === null) return;
    clear(timer);
    timer = null;
  });
}
