/**
 * 戳一戳工具测试
 * 覆盖私聊、群聊与工具调用行为
 */

import { describe, expect, it, vi } from "vitest";
import { createPokeTool, sendPoke } from "../../../../src/features/native-tools/tools/poke";

function createOneBotSession(overrides: Record<string, unknown> = {}) {
  const request = vi.fn().mockResolvedValue(undefined);
  return {
    session: {
      platform: "onebot",
      bot: { internal: { _request: request } },
      ...overrides,
    } as any,
    request,
  };
}

describe("sendPoke", () => {
  it("NapCat 私聊调用 friend_poke 接口", async () => {
    const { session, request } = createOneBotSession();

    const result = await sendPoke({
      session,
      userId: "user-1",
      protocol: "napcat",
    });

    expect(request).toHaveBeenCalledWith("friend_poke", {
      user_id: "user-1",
    });
    expect(result).toBe("已在 私聊 戳了一下 user-1。");
  });

  it("NapCat 私聊存在 channelId 时仍调用 friend_poke 接口", async () => {
    const { session, request } = createOneBotSession({
      channelId: "private-channel",
    });

    const result = await sendPoke({
      session,
      userId: "user-1",
      protocol: "napcat",
    });

    expect(request).toHaveBeenCalledWith("friend_poke", {
      user_id: "user-1",
    });
    expect(result).toBe("已在 私聊 戳了一下 user-1。");
  });

  it("NapCat 群聊调用 group_poke 接口", async () => {
    const { session, request } = createOneBotSession({ guildId: "group-1" });

    const result = await sendPoke({
      session,
      userId: "user-1",
      protocol: "napcat",
    });

    expect(request).toHaveBeenCalledWith("group_poke", {
      user_id: "user-1",
      group_id: "group-1",
    });
    expect(result).toBe("已在 群 group-1 戳了一下 user-1。");
  });

  it("LLBot 私聊调用 friend_poke 接口", async () => {
    const { session, request } = createOneBotSession();

    const result = await sendPoke({
      session,
      userId: "user-1",
      protocol: "llbot",
    });

    expect(request).toHaveBeenCalledWith("friend_poke", {
      user_id: "user-1",
    });
    expect(result).toBe("已在 私聊 戳了一下 user-1。");
  });
});

describe("createPokeTool", () => {
  it("创建可调用的戳一戳工具", async () => {
    const tool = createPokeTool({
      ctx: {} as any,
      toolName: "poke_user",
      description: "desc",
      protocol: "llbot",
    });

    expect(tool.name).toBe("poke_user");
    expect(typeof tool.invoke).toBe("function");
  });
});
