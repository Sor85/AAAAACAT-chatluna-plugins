/**
 * 变量注册
 * 负责向 ChatLuna promptRenderer 注册函数变量
 */

import type { Config, LogFn } from "../../types";
import { createBotInfoProvider } from "./providers/bot-info";
import { createGroupInfoProvider } from "./providers/group-info";
import { createGroupShutListProvider } from "./providers/group-shut-list";
import { createRandomProvider } from "./providers/random";
import { createUserInfoProvider } from "./providers/user-info";

interface ChatLunaPromptRenderer {
  registerFunctionProvider?: (name: string, provider: unknown) => void;
}

interface ChatLunaServiceLike {
  promptRenderer?: ChatLunaPromptRenderer;
}

export interface RegisterVariablesDeps {
  ctx: import("koishi").Context;
  config: Config;
  log?: LogFn;
}

export function registerVariables(deps: RegisterVariablesDeps): void {
  const { ctx, config, log } = deps;
  const chatlunaService = (ctx as unknown as { chatluna?: ChatLunaServiceLike })
    .chatluna;
  const promptRenderer = chatlunaService?.promptRenderer;
  if (!promptRenderer?.registerFunctionProvider) return;

  const userInfoProvider = createUserInfoProvider({ config });
  const userInfoName = String(
    config.userInfo?.variableName || "userInfo",
  ).trim();
  if (userInfoName) {
    promptRenderer.registerFunctionProvider(userInfoName, userInfoProvider);
    log?.("info", `用户信息变量已注册: ${userInfoName}`);
  }

  const botInfoProvider = createBotInfoProvider({ config });
  const botInfoName = String(config.botInfo?.variableName || "botInfo").trim();
  if (botInfoName) {
    promptRenderer.registerFunctionProvider(botInfoName, botInfoProvider);
    log?.("info", `Bot信息变量已注册: ${botInfoName}`);
  }

  const groupInfoProvider = createGroupInfoProvider({ config, log });
  const groupInfoName = String(
    config.groupInfo?.variableName || "groupInfo",
  ).trim();
  if (groupInfoName) {
    promptRenderer.registerFunctionProvider(groupInfoName, groupInfoProvider);
    log?.("info", `群组信息变量已注册: ${groupInfoName}`);
  }

  const groupShutListProvider = createGroupShutListProvider({ config, log });
  const groupShutListName = String(
    config.groupShutList?.variableName || "groupShutList",
  ).trim();
  if (groupShutListName) {
    promptRenderer.registerFunctionProvider(
      groupShutListName,
      groupShutListProvider,
    );
    log?.("info", `群禁言列表变量已注册: ${groupShutListName}`);
  }

  const randomProvider = createRandomProvider({ config });
  const randomName = String(config.random?.variableName || "random").trim();
  if (randomName) {
    promptRenderer.registerFunctionProvider(randomName, randomProvider);
    log?.("info", `随机数变量已注册: ${randomName}`);
  }
}
