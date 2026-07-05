/**
 * 群成员踢出工具测试
 * 覆盖 OneBot 调用与适配器 fallback
 */

import { describe, expect, it, vi } from "vitest";
import { createSetGroupKickTool, sendGroupKick } from "../../../../src/features/native-tools/tools/set-group-kick";

describe("sendGroupKick", () => {
  it("调用 set_group_kick 接口踢出群成员", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const result = await sendGroupKick({
      session: {
        platform: "onebot",
        guildId: "group-1",
        bot: { internal: { _request: request } },
      } as any,
      userId: "user-1",
    });

    expect(request).toHaveBeenCalledWith("set_group_kick", {
      group_id: "group-1",
      user_id: "user-1",
    });
    expect(result).toBe("已将用户 user-1 移出群 group-1。");
  });

  it("在没有 _request 时回退到 setGroupKick", async () => {
    const setGroupKick = vi.fn().mockResolvedValue(undefined);
    const result = await sendGroupKick({
      session: {
        platform: "onebot",
        channelId: "group-1",
        bot: { internal: { setGroupKick } },
      } as any,
      userId: "user-1",
    });

    expect(setGroupKick).toHaveBeenCalledWith({
      group_id: "group-1",
      user_id: "user-1",
    });
    expect(result).toBe("已将用户 user-1 移出群 group-1。");
  });

  it("在缺少用户 ID 时返回错误", async () => {
    const result = await sendGroupKick({
      session: {
        platform: "onebot",
        guildId: "group-1",
        bot: { internal: { _request: vi.fn() } },
      } as any,
      userId: " ",
    });

    expect(result).toBe("userId is required.");
  });
});

describe("createSetGroupKickTool", () => {
  it("创建可调用的踢人工具", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const tool = createSetGroupKickTool({
      toolName: "set_group_kick",
      description: "desc",
    });

    expect(tool.name).toBe("set_group_kick");
    expect(tool.description).toBe("desc");

    const result = await tool.invoke(
      { userId: "user-1" },
      {
        configurable: {
          session: {
            platform: "onebot",
            guildId: "group-1",
            bot: { internal: { _request: request } },
          },
        },
      },
    );

    expect(request).toHaveBeenCalledWith("set_group_kick", {
      group_id: "group-1",
      user_id: "user-1",
    });
    expect(result).toBe("已将用户 user-1 移出群 group-1。");
  });
});
