/**
 * 原生工具注册测试
 * 覆盖协议选择、原生工具配置与注册行为
 */

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { registerNativeTools, resolveOneBotProtocol } from "../../../src/features/native-tools/register";
import type { Config } from "../../../src/types";
import {
  DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION,
  DEFAULT_LEAVE_GROUP_TOOL_DESCRIPTION,
  DEFAULT_POKE_TOOL_DESCRIPTION,
  DEFAULT_SEARCH_GROUP_MEMBER_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_KICK_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_SPECIAL_TITLE_TOOL_DESCRIPTION,
  DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION,
  DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION,
  DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION,
} from "../../../src/features/native-tools/defaults";

const TOOL_DEFAULT_AVAILABILITY = {
  enabled: true,
  main: true,
  chatluna: true,
  characterScope: "all",
} as const;

function createConfig(overrides: Partial<Config> = {}): Config {
  return {
    oneBotProtocol: "napcat",
    enabledNativeTools: [],
    poke: {
      enabled: false,
      toolName: "poke_user",
      description: DEFAULT_POKE_TOOL_DESCRIPTION,
    },
    setSelfProfile: {
      enabled: false,
      toolName: "set_self_profile",
      description: DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION,
    },
    setQQAvatar: {
      enabled: false,
      toolName: "set_qq_avatar",
      description: DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION,
    },
    setGroupCard: {
      enabled: false,
      toolName: "set_group_card",
      description: DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION,
    },
    searchGroupMember: {
      enabled: false,
      toolName: "search_group_member",
      description: DEFAULT_SEARCH_GROUP_MEMBER_TOOL_DESCRIPTION,
    },
    setGroupBan: {
      enabled: false,
      toolName: "set_group_ban",
      description: DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION,
    },
    leaveGroup: {
      enabled: false,
      toolName: "set_group_leave",
      description: DEFAULT_LEAVE_GROUP_TOOL_DESCRIPTION,
    },
    setGroupKick: {
      enabled: false,
      toolName: "set_group_kick",
      description: DEFAULT_SET_GROUP_KICK_TOOL_DESCRIPTION,
    },
    setGroupSpecialTitle: {
      enabled: false,
      toolName: "set_group_special_title",
      description: DEFAULT_SET_GROUP_SPECIAL_TITLE_TOOL_DESCRIPTION,
    },
    setMsgEmoji: {
      enabled: false,
      toolName: "set_msg_emoji",
      description: DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION,
    },
    deleteMessage: {
      enabled: false,
      toolName: "delete_msg",
      description: DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION,
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

describe("resolveOneBotProtocol", () => {
  it("在 oneBotProtocol 为 llbot 时返回 llbot", () => {
    const config = createConfig({
      oneBotProtocol: "llbot",
    });

    expect(resolveOneBotProtocol(config)).toBe("llbot");
  });

  it("在 oneBotProtocol 为 napcat 时返回 napcat", () => {
    expect(resolveOneBotProtocol(createConfig())).toBe("napcat");
  });
});

describe("registerNativeTools", () => {
  it("将工具选择和工具配置放在同一原生工具分组", () => {
    const source = readFileSync("src/schema/native-tools.ts", "utf8");

    expect(source).toContain("export const NativeToolsSchema = Schema.object({");
    expect(source).toContain("enabledNativeTools: EnabledNativeToolsSchema");
    expect(source).toContain("poke: Schema.object({");
    expect(source).toContain("deleteMessage: Schema.object({");
    expect(source).not.toContain("NativeToolAdvancedSettingsSchema");
    expect(source).not.toContain("Schema.intersect");
  });

  it("按复选框列表注册启用的原生工具", () => {
    const registerTool = vi.fn();
    const config = createConfig({
      enabledNativeTools: [
        "poke",
        "setGroupBan",
        "leaveGroup",
        "setGroupKick",
        "setGroupSpecialTitle",
        "setMsgEmoji",
      ],
      poke: {
        toolName: "custom_poke",
        description: "custom poke description",
      },
      setMsgEmoji: {
        toolName: "custom_emoji",
        description: "custom emoji description",
      },
      setGroupBan: {
        toolName: "custom_ban",
        description: "custom ban description",
      },
      leaveGroup: {
        toolName: "custom_leave",
        description: "custom leave description",
      },
      setGroupKick: {
        toolName: "custom_kick",
        description: "custom kick description",
      },
      setGroupSpecialTitle: {
        toolName: "custom_title",
        description: "custom title description",
      },
    });

    registerNativeTools({
      ctx: {} as never,
      config,
      plugin: { registerTool },
      protocol: "napcat",
    });

    expect(registerTool).toHaveBeenCalledTimes(6);
    expect(registerTool).toHaveBeenNthCalledWith(
      1,
      "custom_poke",
      expect.objectContaining({
        selector: expect.any(Function),
        authorization: expect.any(Function),
        description: "custom poke description",
        createTool: expect.any(Function),
        meta: expect.objectContaining({
          tags: ["poke"],
          defaultAvailability: TOOL_DEFAULT_AVAILABILITY,
        }),
      }),
    );
    expect(registerTool).toHaveBeenNthCalledWith(
      2,
      "custom_ban",
      expect.objectContaining({
        selector: expect.any(Function),
        authorization: expect.any(Function),
        description: "custom ban description",
        createTool: expect.any(Function),
        meta: expect.objectContaining({
          tags: ["group"],
          defaultAvailability: TOOL_DEFAULT_AVAILABILITY,
        }),
      }),
    );
    expect(registerTool).toHaveBeenNthCalledWith(
      3,
      "custom_leave",
      expect.objectContaining({
        selector: expect.any(Function),
        authorization: expect.any(Function),
        description: "custom leave description",
        createTool: expect.any(Function),
        meta: expect.objectContaining({
          tags: ["group"],
          defaultAvailability: TOOL_DEFAULT_AVAILABILITY,
        }),
      }),
    );
    expect(registerTool).toHaveBeenNthCalledWith(
      4,
      "custom_kick",
      expect.objectContaining({
        selector: expect.any(Function),
        authorization: expect.any(Function),
        description: "custom kick description",
        createTool: expect.any(Function),
        meta: expect.objectContaining({
          tags: ["group"],
          defaultAvailability: TOOL_DEFAULT_AVAILABILITY,
        }),
      }),
    );
    expect(registerTool).toHaveBeenNthCalledWith(
      5,
      "custom_title",
      expect.objectContaining({
        selector: expect.any(Function),
        authorization: expect.any(Function),
        description: "custom title description",
        createTool: expect.any(Function),
        meta: expect.objectContaining({
          tags: ["group"],
          defaultAvailability: TOOL_DEFAULT_AVAILABILITY,
        }),
      }),
    );
    expect(registerTool).toHaveBeenNthCalledWith(
      6,
      "custom_emoji",
      expect.objectContaining({
        selector: expect.any(Function),
        authorization: expect.any(Function),
        description: "custom emoji description",
        createTool: expect.any(Function),
        meta: expect.objectContaining({
          tags: ["message"],
          defaultAvailability: TOOL_DEFAULT_AVAILABILITY,
        }),
      }),
    );
  });

  it("将自定义描述注入最终工具对象", () => {
    const registerTool = vi.fn();
    const config = createConfig({
      enabledNativeTools: ["poke"],
      poke: {
        toolName: "custom_poke",
        description: "poke custom description",
      },
    });

    registerNativeTools({
      ctx: {} as never,
      config,
      plugin: { registerTool },
      protocol: "napcat",
    });

    const registration = registerTool.mock.calls[0][1];
    const tool = registration.createTool();

    expect(tool.description).toBe("poke custom description");
  });

  it("在工具名为空白时回退到默认名称", () => {
    const registerTool = vi.fn();
    const config = createConfig({
      enabledNativeTools: ["poke"],
      poke: {
        toolName: "   ",
        description: DEFAULT_POKE_TOOL_DESCRIPTION,
      },
    });

    registerNativeTools({
      ctx: {} as never,
      config,
      plugin: { registerTool },
      protocol: "napcat",
    });

    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool).toHaveBeenCalledWith(
      "poke_user",
      expect.objectContaining({
        selector: expect.any(Function),
        authorization: expect.any(Function),
        description: DEFAULT_POKE_TOOL_DESCRIPTION,
        createTool: expect.any(Function),
        meta: expect.objectContaining({
          tags: ["poke"],
          defaultAvailability: TOOL_DEFAULT_AVAILABILITY,
        }),
      }),
    );
  });

  it("在描述为空白时回退到默认描述", () => {
    const registerTool = vi.fn();
    const config = createConfig({
      enabledNativeTools: ["setMsgEmoji"],
      setMsgEmoji: {
        toolName: "set_msg_emoji",
        description: "   ",
      },
    });

    registerNativeTools({
      ctx: {} as never,
      config,
      plugin: { registerTool },
      protocol: "napcat",
    });

    const registration = registerTool.mock.calls[0][1];
    const tool = registration.createTool();

    expect(tool.description).toBe(DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION);
  });

  it("按约定写入各工具标签", () => {
    const registerTool = vi.fn();
    const config = createConfig({
      enabledNativeTools: [
        "poke",
        "setSelfProfile",
        "setQQAvatar",
        "setGroupCard",
        "searchGroupMember",
        "setGroupBan",
        "leaveGroup",
        "setGroupKick",
        "setGroupSpecialTitle",
        "setMsgEmoji",
        "deleteMessage",
      ],
      poke: {
        toolName: "poke_user",
        description: DEFAULT_POKE_TOOL_DESCRIPTION,
      },
      setSelfProfile: {
        toolName: "set_self_profile",
        description: DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION,
      },
      setQQAvatar: {
        toolName: "set_qq_avatar",
        description: DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION,
      },
      setGroupCard: {
        toolName: "set_group_card",
        description: DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION,
      },
      searchGroupMember: {
        toolName: "search_group_member",
        description: DEFAULT_SEARCH_GROUP_MEMBER_TOOL_DESCRIPTION,
      },
      setGroupBan: {
        toolName: "set_group_ban",
        description: DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION,
      },
      leaveGroup: {
        toolName: "set_group_leave",
        description: DEFAULT_LEAVE_GROUP_TOOL_DESCRIPTION,
      },
      setGroupKick: {
        toolName: "set_group_kick",
        description: DEFAULT_SET_GROUP_KICK_TOOL_DESCRIPTION,
      },
      setGroupSpecialTitle: {
        toolName: "set_group_special_title",
        description: DEFAULT_SET_GROUP_SPECIAL_TITLE_TOOL_DESCRIPTION,
      },
      setMsgEmoji: {
        toolName: "set_msg_emoji",
        description: DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION,
      },
      deleteMessage: {
        toolName: "delete_msg",
        description: DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION,
      },
    });

    registerNativeTools({
      ctx: {} as never,
      config,
      plugin: { registerTool },
      protocol: "napcat",
    });

    const registrationsByName = new Map(
      registerTool.mock.calls.map(([name, options]) => [name, options]),
    );

    expect(registrationsByName.get("delete_msg").meta.tags).toEqual(["message"]);
    expect(registrationsByName.get("set_group_kick").meta.tags).toEqual(["group"]);
    expect(registrationsByName.get("set_group_leave").meta.tags).toEqual(["group"]);
    expect(registrationsByName.get("poke_user").meta.tags).toEqual(["poke"]);
    expect(registrationsByName.get("search_group_member").meta.tags).toEqual(["group"]);
    expect(registrationsByName.get("set_group_ban").meta.tags).toEqual(["group"]);
    expect(registrationsByName.get("set_group_card").meta.tags).toEqual(["group"]);
    expect(registrationsByName.get("set_group_special_title").meta.tags).toEqual(["group"]);
    expect(registrationsByName.get("set_msg_emoji").meta.tags).toEqual(["message"]);
    expect(registrationsByName.get("set_self_profile").meta.tags).toEqual([]);
    expect(registrationsByName.get("set_qq_avatar").meta.tags).toEqual(["profile"]);
  });

  it("兼容旧版嵌套 enabled 配置", () => {
    const registerTool = vi.fn();
    const config = createConfig({
      enabledNativeTools: undefined,
      poke: {
        enabled: true,
        toolName: "custom_poke",
        description: "custom poke description",
      },
    });

    registerNativeTools({
      ctx: {} as never,
      config,
      plugin: { registerTool },
      protocol: "napcat",
    });

    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool).toHaveBeenCalledWith(
      "custom_poke",
      expect.objectContaining({
        description: "custom poke description",
      }),
    );
  });

  it("忽略未启用的原生工具", () => {
    const registerTool = vi.fn();

    registerNativeTools({
      ctx: {} as never,
      config: createConfig(),
      plugin: { registerTool },
      protocol: "napcat",
    });

    expect(registerTool).not.toHaveBeenCalled();
  });
});
