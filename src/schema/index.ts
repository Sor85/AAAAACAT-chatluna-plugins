/**
 * Schema 统一导出
 * 组合所有子 Schema 并导出完整配置类型
 */

import { Schema } from "koishi";
import { AffinitySchema } from "./affinity";
import { BlacklistSchema } from "./blacklist";
import { RelationshipSchema } from "./relationship";
import {
  VariableSettingsSchema,
  NativeToolSettingsSchema,
  XmlToolSettingsSchema,
  OtherSettingsSchema,
} from "./tools";
export * from "./affinity";
export * from "./blacklist";
export * from "./relationship";
export * from "./tools";

export const name = "chatluna-affinity";

export const inject = {
  required: ["chatluna", "database"],
  optional: [
    "puppeteer",
    "console",
    "chatluna_group_analysis",
    "chatluna_character",
  ],
};

export const ConfigSchema = Schema.intersect([
  AffinitySchema,
  BlacklistSchema,
  RelationshipSchema,
  VariableSettingsSchema,
  NativeToolSettingsSchema,
  XmlToolSettingsSchema,
  OtherSettingsSchema,
]);

export { ConfigSchema as Config };
