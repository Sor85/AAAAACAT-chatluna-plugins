/**
 * 原生工具注册
 * 负责将 OneBot 工具注册到 ChatLuna
 */

import type { Session } from "koishi";
import type {
  Config,
  LogFn,
  NativeToolKey,
  OneBotProtocol,
} from "../../types";
import {
  DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION,
  DEFAULT_POKE_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION,
  DEFAULT_SET_GROUP_SPECIAL_TITLE_TOOL_DESCRIPTION,
  DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION,
  DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION,
  DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION,
} from "./defaults";
import { createDeleteMessageTool } from "./tools/delete-msg";
import { createPokeTool } from "./tools/poke";
import { createSetGroupBanTool } from "./tools/set-group-ban";
import { createSetGroupCardTool } from "./tools/set-group-card";
import { createSetGroupSpecialTitleTool } from "./tools/set-group-special-title";
import { createSetMsgEmojiTool } from "./tools/set-msg-emoji";
import { createSetProfileTool } from "./tools/profile";
import { createSetQQAvatarTool } from "./tools/set-qq-avatar";

interface ToolDefaultAvailability {
  enabled: true;
  main: true;
  chatluna: true;
  characterScope: "all";
}

interface NativeToolMeta {
  source: "extension";
  group: string;
  tags: string[];
  defaultAvailability: ToolDefaultAvailability;
}

export interface NativeToolRegistration {
  selector: () => boolean;
  authorization: (session: Session) => boolean;
  description: string;
  createTool: () => unknown;
  meta: NativeToolMeta;
}

const NATIVE_TOOL_DEFAULT_AVAILABILITY: ToolDefaultAvailability = {
  enabled: true,
  main: true,
  chatluna: true,
  characterScope: "all",
};

function createNativeToolMeta(group: string, tags: string[]): NativeToolMeta {
  return {
    source: "extension",
    group,
    tags,
    defaultAvailability: NATIVE_TOOL_DEFAULT_AVAILABILITY,
  };
}

export interface RegisterNativeToolsDeps {
  ctx: import("koishi").Context;
  config: Config;
  plugin: {
    registerTool: (name: string, tool: NativeToolRegistration) => void;
  };
  protocol: OneBotProtocol;
  log?: LogFn;
}

function resolveToolName(value: string, fallback: string): string {
  const trimmedValue = value.trim();
  return trimmedValue || fallback;
}

function resolveToolDescription(value: string, fallback: string): string {
  const trimmedValue = value.trim();
  return trimmedValue || fallback;
}

function isNativeToolEnabled(config: Config, toolKey: NativeToolKey): boolean {
  // 新版配置使用集中复选框；旧配置只存在各工具内的 enabled，缺省时继续读取旧字段。
  if (config.enabledNativeTools) {
    return config.enabledNativeTools.includes(toolKey);
  }

  return config[toolKey].enabled ?? false;
}

export function resolveOneBotProtocol(
  config: Config,
  log?: LogFn,
): OneBotProtocol {
  return config.oneBotProtocol;
}

export function registerNativeTools(deps: RegisterNativeToolsDeps): void {
  const { ctx, config, plugin, protocol, log } = deps;

  if (isNativeToolEnabled(config, "poke")) {
    const toolName = resolveToolName(config.poke.toolName, "poke_user");
    const description = resolveToolDescription(
      config.poke.description,
      DEFAULT_POKE_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: (session: Session) => session?.platform === "onebot",
      description,
      createTool: () =>
        createPokeTool({ ctx, toolName, description, log, protocol }),
      meta: createNativeToolMeta("onebot", ["poke"]),
    });
    log?.("info", `戳一戳工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "setSelfProfile")) {
    const toolName = resolveToolName(
      config.setSelfProfile.toolName,
      "set_self_profile",
    );
    const description = resolveToolDescription(
      config.setSelfProfile.description,
      DEFAULT_SET_SELF_PROFILE_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: (session: Session) => session?.platform === "onebot",
      description,
      createTool: () =>
        createSetProfileTool({ ctx, toolName, description, log, protocol }),
      meta: createNativeToolMeta("onebot", []),
    });
    log?.("info", `设置资料工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "setQQAvatar")) {
    const toolName = resolveToolName(
      config.setQQAvatar.toolName,
      "set_qq_avatar",
    );
    const description = resolveToolDescription(
      config.setQQAvatar.description,
      DEFAULT_SET_QQ_AVATAR_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: (session: Session) => session?.platform === "onebot",
      description,
      createTool: () =>
        createSetQQAvatarTool({ ctx, toolName, description, log }),
      meta: createNativeToolMeta("onebot", ["profile"]),
    });
    log?.("info", `QQ 头像工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "setGroupCard")) {
    const toolName = resolveToolName(
      config.setGroupCard.toolName,
      "set_group_card",
    );
    const description = resolveToolDescription(
      config.setGroupCard.description,
      DEFAULT_SET_GROUP_CARD_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: (session: Session) => session?.platform === "onebot",
      description,
      createTool: () =>
        createSetGroupCardTool({ ctx, toolName, description, log }),
      meta: createNativeToolMeta("onebot", ["group"]),
    });
    log?.("info", `群昵称工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "setGroupBan")) {
    const toolName = resolveToolName(
      config.setGroupBan.toolName,
      "set_group_ban",
    );
    const description = resolveToolDescription(
      config.setGroupBan.description,
      DEFAULT_SET_GROUP_BAN_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: (session: Session) => session?.platform === "onebot",
      description,
      createTool: () =>
        createSetGroupBanTool({ toolName, description, log, protocol }),
      meta: createNativeToolMeta("onebot", ["group"]),
    });
    log?.("info", `群成员禁言工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "setGroupSpecialTitle")) {
    const toolName = resolveToolName(
      config.setGroupSpecialTitle.toolName,
      "set_group_special_title",
    );
    const description = resolveToolDescription(
      config.setGroupSpecialTitle.description,
      DEFAULT_SET_GROUP_SPECIAL_TITLE_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: (session: Session) => session?.platform === "onebot",
      description,
      createTool: () =>
        createSetGroupSpecialTitleTool({
          toolName,
          description,
          log,
          protocol,
        }),
      meta: createNativeToolMeta("onebot", ["group"]),
    });
    log?.("info", `群专属头衔工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "setMsgEmoji")) {
    const toolName = resolveToolName(
      config.setMsgEmoji.toolName,
      "set_msg_emoji",
    );
    const description = resolveToolDescription(
      config.setMsgEmoji.description,
      DEFAULT_SET_MSG_EMOJI_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: (session: Session) => session?.platform === "onebot",
      description,
      createTool: () =>
        createSetMsgEmojiTool({ toolName, description, log, protocol }),
      meta: createNativeToolMeta("onebot", ["message"]),
    });
    log?.("info", `消息表情工具已注册: ${toolName}`);
  }

  if (isNativeToolEnabled(config, "deleteMessage")) {
    const toolName = resolveToolName(
      config.deleteMessage.toolName,
      "delete_msg",
    );
    const description = resolveToolDescription(
      config.deleteMessage.description,
      DEFAULT_DELETE_MESSAGE_TOOL_DESCRIPTION,
    );
    plugin.registerTool(toolName, {
      selector: () => true,
      authorization: (session: Session) => session?.platform === "onebot",
      description,
      createTool: () => createDeleteMessageTool({ toolName, description, log }),
      meta: createNativeToolMeta("onebot", ["message"]),
    });
    log?.("info", `删除消息工具已注册: ${toolName}`);
  }
}
