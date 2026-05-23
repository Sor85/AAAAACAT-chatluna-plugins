/**
 * 消息表情工具测试
 * 覆盖 OneBot 调用与协议差异
 */

import { describe, expect, it, vi } from "vitest";
import { createSetMsgEmojiTool, sendMsgEmoji } from "../../../../src/features/native-tools/tools/set-msg-emoji";

describe("sendMsgEmoji", () => {
  it("NapCat 调用 set_msg_emoji_like 并发送 set 标记", async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    const result = await sendMsgEmoji({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      messageId: "12345",
      emojiId: "66",
      protocol: "napcat",
    });

    expect(request).toHaveBeenCalledWith("set_msg_emoji_like", {
      message_id: 12345,
      emoji_id: "66",
      set: true,
    });
    expect(result).toBe("Emoji 66 sent to message 12345.");
  });

  it("LLBot 群聊调用 set_msg_emoji_like", async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    const result = await sendMsgEmoji({
      session: {
        platform: "onebot",
        guildId: "group-1",
        bot: { internal: { _request: request } },
      } as any,
      messageId: "abc",
      emojiId: "66",
      protocol: "llbot",
    });

    expect(request).toHaveBeenCalledWith("set_msg_emoji_like", {
      message_id: "abc",
      emoji_id: "66",
    });
    expect(result).toBe("Emoji 66 sent to message abc.");
  });

  it("LLBot 私聊返回不支持表情回应", async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    const result = await sendMsgEmoji({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      messageId: "12345",
      emojiId: "66",
      protocol: "llbot",
    });

    expect(request).not.toHaveBeenCalled();
    expect(result).toBe("当前会话不是群聊，LLBot 不支持私聊表情回应。");
  });
});

describe("createSetMsgEmojiTool", () => {
  it("创建可调用的消息表情工具", () => {
    const tool = createSetMsgEmojiTool({
      toolName: "set_msg_emoji",
      description: "desc",
      protocol: "napcat",
    });

    expect(tool.name).toBe("set_msg_emoji");
    expect(typeof tool.invoke).toBe("function");
  });
});
