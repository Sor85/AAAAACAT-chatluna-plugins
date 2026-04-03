/**
 * 变量注册测试
 * 覆盖变量提供者注册与空白名称回退行为
 */

import { describe, expect, it, vi } from "vitest";
import { registerVariables } from "./register";
import type { Config } from "../../types";

function createConfig(overrides: Partial<Config> = {}): Config {
  return {
    enableNapCatProtocol: true,
    enableLlbotProtocol: false,
    poke: {
      enabled: false,
      toolName: "poke_user",
      description: "",
    },
    setSelfProfile: {
      enabled: false,
      toolName: "set_self_profile",
      description: "",
    },
    setGroupCard: {
      enabled: false,
      toolName: "set_group_card",
      description: "",
    },
    setGroupBan: {
      enabled: false,
      toolName: "set_group_ban",
      description: "",
    },
    setMsgEmoji: {
      enabled: false,
      toolName: "set_msg_emoji",
      description: "",
    },
    deleteMessage: {
      enabled: false,
      toolName: "delete_msg",
      description: "",
    },
    injectXmlToolAsReplyTool: false,
    enablePokeXmlTool: false,
    enableEmojiXmlTool: false,
    enableDeleteXmlTool: false,
    enableBanXmlTool: false,
    referencePrompt: "",
    userInfo: { variableName: "userInfo", items: [] },
    botInfo: { variableName: "botInfo", items: [] },
    groupInfo: { variableName: "groupInfo", items: [] },
    groupShutList: { variableName: "groupShutList" },
    random: { variableName: "random", min: 0, max: 100 },
    debugLogging: false,
    ...overrides,
  };
}

describe("registerVariables", () => {
  it("注册 groupShutList 变量提供者", () => {
    const registerFunctionProvider = vi.fn();

    registerVariables({
      ctx: {
        chatluna: {
          promptRenderer: { registerFunctionProvider },
        },
      } as never,
      config: createConfig(),
    });

    expect(registerFunctionProvider).toHaveBeenCalledWith(
      "groupShutList",
      expect.any(Function),
    );
  });

  it("在 groupShutList.variableName 存在时按自定义名称注册变量提供者", () => {
    const registerFunctionProvider = vi.fn();

    registerVariables({
      ctx: {
        chatluna: {
          promptRenderer: { registerFunctionProvider },
        },
      } as never,
      config: createConfig({
        groupShutList: { variableName: "banList" },
      }),
    });

    expect(registerFunctionProvider).toHaveBeenCalledWith(
      "banList",
      expect.any(Function),
    );
  });

  it("在 groupShutList.variableName 为空白时跳过注册", () => {
    const registerFunctionProvider = vi.fn();

    registerVariables({
      ctx: {
        chatluna: {
          promptRenderer: { registerFunctionProvider },
        },
      } as never,
      config: createConfig({
        groupShutList: { variableName: "   " },
      }),
    });

    expect(registerFunctionProvider).not.toHaveBeenCalledWith(
      "   ",
      expect.any(Function),
    );
    expect(registerFunctionProvider).not.toHaveBeenCalledWith(
      "",
      expect.any(Function),
    );
  });
});
