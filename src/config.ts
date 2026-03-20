/**
 * 变量配置归一化
 * 兼容新旧配置结构并提供稳定的变量名读取结果
 */

import { DEFAULT_VARIABLES_CONFIG } from "./schema";
import type { Config, VariablesConfig } from "./types";

export function resolveVariablesConfig(config: Config): VariablesConfig {
  const legacySchedule = config.schedule as Config["schedule"] & {
    variableName?: string;
    currentVariableName?: string;
    outfitVariableName?: string;
    currentOutfitVariableName?: string;
  };
  const legacyWeather = config.weather as Config["weather"] & {
    variableName?: string;
  };

  return {
    schedule:
      config.variables?.schedule ||
      legacySchedule.variableName ||
      DEFAULT_VARIABLES_CONFIG.schedule,
    currentSchedule:
      config.variables?.currentSchedule ||
      legacySchedule.currentVariableName ||
      DEFAULT_VARIABLES_CONFIG.currentSchedule,
    outfit:
      config.variables?.outfit ||
      legacySchedule.outfitVariableName ||
      DEFAULT_VARIABLES_CONFIG.outfit,
    currentOutfit:
      config.variables?.currentOutfit ||
      legacySchedule.currentOutfitVariableName ||
      DEFAULT_VARIABLES_CONFIG.currentOutfit,
    weather:
      config.variables?.weather ||
      legacyWeather.variableName ||
      DEFAULT_VARIABLES_CONFIG.weather,
  };
}
