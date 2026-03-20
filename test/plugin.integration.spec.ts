/**
 * 集成注册测试
 * 验证 ChatLuna 变量与工具注册流程
 */

import { describe, expect, it, vi } from "vitest";
import type { Context } from "koishi";
import { registerChatLunaIntegrations } from "../src/integrations/chatluna";

describe("chatluna integrations", () => {
  it("registers weather variable and tool", () => {
    const providers: string[] = [];
    const tools: string[] = [];

    const ctx = {
      chatluna: {
        promptRenderer: {
          registerFunctionProvider: (name: string) => {
            providers.push(name);
            return () => {};
          },
        },
      },
    } as unknown as Context;

    const plugin = {
      registerTool: (name: string) => {
        tools.push(name);
      },
    };

    const result = registerChatLunaIntegrations({
      ctx,
      plugin,
      config: {
        schedule: {
          enabled: true,
          model: "",
          personaSource: "none",
          personaChatlunaPreset: "无",
          personaCustomPreset: "",
          timezone: "Asia/Shanghai",
          prompt: "test",
          renderAsImage: false,
          startDelay: 1000,
          registerTool: true,
          toolName: "daily_schedule",
        },
        weather: {
          enabled: true,
          cityName: "上海",
          hourlyRefresh: false,
          registerTool: true,
          toolName: "get_weather",
        },
        variables: {
          schedule: "schedule",
          currentSchedule: "currentSchedule",
          outfit: "outfit",
          currentOutfit: "currentOutfit",
          weather: "weather",
        },
      } as never,
      scheduleService: {
        registerVariables: vi.fn(() => [
          "schedule",
          "currentSchedule",
          "outfit",
          "currentOutfit",
        ]),
        registerTool: vi.fn(() => "daily_schedule"),
      } as never,
      weatherService: {
        getHourlyWeather: vi.fn(async () => "晴，21°C"),
        getWeatherText: vi.fn(async () => "天气文本"),
      } as never,
      log: () => {},
    });

    expect(result.variableNames).toContain("weather");
    expect(result.toolNames).toContain("get_weather");
    expect(providers).toContain("weather");
    expect(tools).toContain("get_weather");
  });

  it("falls back to legacy weather variable when variables are missing", () => {
    const providers: string[] = [];

    const ctx = {
      chatluna: {
        promptRenderer: {
          registerFunctionProvider: (name: string) => {
            providers.push(name);
            return () => {};
          },
        },
      },
    } as unknown as Context;

    registerChatLunaIntegrations({
      ctx,
      plugin: {
        registerTool: vi.fn(),
      } as never,
      config: {
        schedule: {
          enabled: false,
          timezone: "Asia/Shanghai",
          prompt: "test",
          renderAsImage: false,
          startDelay: 1000,
          registerTool: true,
          toolName: "daily_schedule",
        },
        weather: {
          enabled: true,
          cityName: "上海",
          hourlyRefresh: false,
          registerTool: false,
          toolName: "get_weather",
          variableName: "legacyWeather",
        },
      } as never,
      scheduleService: {
        registerVariables: vi.fn(() => []),
        registerTool: vi.fn(() => null),
      } as never,
      weatherService: {
        getHourlyWeather: vi.fn(async () => "晴，21°C"),
        getWeatherText: vi.fn(async () => "天气文本"),
        getEffectiveCityName: vi.fn(() => "上海"),
      } as never,
      log: () => {},
    });

    expect(providers).toContain("legacyWeather");
  });
});
