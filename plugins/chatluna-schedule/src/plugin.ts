/**
 * 插件装配入口
 * 负责初始化服务、注册命令与生命周期清理
 */

import type { Context } from "koishi";
import { ChatLunaPlugin } from "koishi-plugin-chatluna/services/chat";
import { getMessageContent } from "koishi-plugin-chatluna/utils/string";
import { registerChatLunaIntegrations } from "./integrations/chatluna";
import { createScheduleRenderer } from "./renders/schedule";
import { createScheduleService } from "./services/schedule-service";
import { createWeatherService } from "./services/weather-service";
import type {
  ChatLunaContextLike,
  Config,
  LogFn,
  ScheduleService,
  WeatherService,
} from "./types";

interface PluginRuntime {
  scheduleService: ScheduleService;
  weatherService: WeatherService;
  dispose: () => void;
}

function createLogger(ctx: Context, config: Config): LogFn {
  const base = ctx.logger ? ctx.logger("chatluna-schedule") : console;

  return (level, message, detail) => {
    if (!config.debugLogging && level === "debug") return;

    const baseRecord = base as unknown as Record<string, unknown>;
    const writer =
      typeof baseRecord[level] === "function"
        ? (baseRecord[level] as (...args: unknown[]) => void)
        : (base as { info?: (...args: unknown[]) => void }).info || console.log;

    if (detail === undefined) {
      writer.call(base, message);
      return;
    }

    writer.call(base, message, detail);
  };
}

function resolveSchedulePersonaPreset(ctx: Context, config: Config): string {
  const scheduleCfg = config.schedule || ({} as Config["schedule"]);
  const source = scheduleCfg.personaSource || "none";
  const chatluna = (ctx as unknown as { chatluna?: ChatLunaContextLike })
    .chatluna;

  if (source === "chatluna") {
    let presetName = String(scheduleCfg.personaChatlunaPreset ?? "").trim();
    if (presetName === "无") presetName = "";

    if (presetName) {
      const presetRef = chatluna?.preset?.getPreset?.(presetName);
      const presetValue = presetRef?.value as
        | string
        | {
            rawText?: string;
            config?: { prompt?: string };
          }
        | undefined;

      if (typeof presetValue === "string") return presetValue;
      if (presetValue?.rawText) return presetValue.rawText;
      if (presetValue?.config?.prompt) return presetValue.config.prompt;
    }

    return chatluna?.personaPrompt || "";
  }

  if (source === "custom") {
    return String(scheduleCfg.personaCustomPreset ?? "").trim();
  }

  return "";
}

function createRuntime(ctx: Context, config: Config): PluginRuntime {
  const log = createLogger(ctx, config);
  // @ts-expect-error ChatLunaPlugin 配置类型在插件侧与运行时兼容
  const plugin = new ChatLunaPlugin(ctx, config, "schedule", false);
  const weatherService = createWeatherService({
    ctx,
    weatherConfig: config.weather,
    log,
  });
  const renderSchedule = createScheduleRenderer(ctx, log);

  let scheduleModelRef: { value?: unknown } | unknown;
  let defaultModelRef: { value?: unknown } | unknown;

  const scheduleService = createScheduleService({
    ctx,
    config,
    getModel: () => {
      const scheduleModel =
        (scheduleModelRef as { value?: unknown })?.value ?? scheduleModelRef;
      if (scheduleModel)
        return scheduleModel as {
          invoke?: (prompt: string) => Promise<{ content?: unknown } | unknown>;
        };

      const defaultModel =
        (defaultModelRef as { value?: unknown })?.value ?? defaultModelRef;
      if (!defaultModel) return null;
      return defaultModel as {
        invoke?: (prompt: string) => Promise<{ content?: unknown } | unknown>;
      };
    },
    getMessageContent: getMessageContent as (content: unknown) => string,
    resolvePersonaPreset: () => resolveSchedulePersonaPreset(ctx, config),
    getWeatherText: () => weatherService.getDailyWeather(),
    renderSchedule,
    log,
  });

  scheduleService.registerCommand();

  let initialized = false;

  const initialize = async () => {
    if (initialized) return;

    const chatlunaService = (
      ctx as unknown as { chatluna?: ChatLunaContextLike }
    ).chatluna;
    if (!chatlunaService) {
      log("warn", "未检测到 chatluna 服务，跳过初始化");
      return;
    }

    initialized = true;
    const scheduleModelName = String(config.schedule?.model || "").trim();

    if (scheduleModelName) {
      try {
        scheduleModelRef =
          await chatlunaService?.createChatModel?.(scheduleModelName);
      } catch (error) {
        log("warn", `日程模型 ${scheduleModelName} 初始化失败`, error);
      }
    }

    try {
      const defaultModel = chatlunaService?.config?.defaultModel || "";
      defaultModelRef = await chatlunaService?.createChatModel?.(defaultModel);
    } catch (error) {
      log("warn", "默认模型初始化失败", error);
    }

    registerChatLunaIntegrations({
      ctx,
      plugin,
      config,
      scheduleService,
      weatherService,
      log,
    });

    scheduleService.start();
  };

  if (ctx.root.lifecycle.isActive) {
    void initialize();
  }

  const readyDispose = ctx.on("ready", initialize);

  return {
    scheduleService,
    weatherService,
    dispose: () => {
      readyDispose();
      scheduleService.dispose();
      weatherService.invalidateCache();
    },
  };
}

export function apply(ctx: Context, config: Config): void {
  const runtime = createRuntime(ctx, config);
  ctx.on("dispose", () => {
    runtime.dispose();
  });
}
