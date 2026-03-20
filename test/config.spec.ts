/**
 * 变量配置归一化测试
 * 验证新旧配置结构下的变量名解析优先级
 */

import { describe, expect, it } from "vitest";
import { resolveVariablesConfig } from "../src/config";

describe("resolveVariablesConfig", () => {
  it("uses new variables config when present", () => {
    const result = resolveVariablesConfig({
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
        schedule: "todaySchedule",
        currentSchedule: "nowSchedule",
        outfit: "todayOutfit",
        currentOutfit: "nowOutfit",
        weather: "todayWeather",
      },
    });

    expect(result).toEqual({
      schedule: "todaySchedule",
      currentSchedule: "nowSchedule",
      outfit: "todayOutfit",
      currentOutfit: "nowOutfit",
      weather: "todayWeather",
    });
  });

  it("falls back to legacy config fields when variables are missing", () => {
    const result = resolveVariablesConfig({
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
        variableName: "legacySchedule",
        currentVariableName: "legacyCurrentSchedule",
        outfitVariableName: "legacyOutfit",
        currentOutfitVariableName: "legacyCurrentOutfit",
      },
      weather: {
        enabled: true,
        cityName: "上海",
        hourlyRefresh: false,
        registerTool: true,
        toolName: "get_weather",
        variableName: "legacyWeather",
      },
    } as never);

    expect(result).toEqual({
      schedule: "legacySchedule",
      currentSchedule: "legacyCurrentSchedule",
      outfit: "legacyOutfit",
      currentOutfit: "legacyCurrentOutfit",
      weather: "legacyWeather",
    });
  });
});
