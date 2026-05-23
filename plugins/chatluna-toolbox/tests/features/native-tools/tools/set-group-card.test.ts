/**
 * 群昵称设置工具测试
 * 覆盖 OneBot 调用与群号解析
 */

import { describe, expect, it, vi } from "vitest";
import { createSetGroupCardTool, sendSetGroupCard } from "../../../../src/features/native-tools/tools/set-group-card";

describe("sendSetGroupCard", () => {
  it("调用 set_group_card 接口修改群昵称", async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    const result = await sendSetGroupCard({
      session: {
        platform: "onebot",
        guildId: "group-1",
        bot: { internal: { _request: request } },
      } as any,
      userId: "user-1",
      card: "新名片",
    });

    expect(request).toHaveBeenCalledWith("set_group_card", {
      group_id: "group-1",
      user_id: "user-1",
      card: "新名片",
    });
    expect(result).toBe("群昵称已更新：user-1 -> 新名片");
  });

  it("在没有 _request 时回退到 setGroupCard", async () => {
    const setGroupCard = vi.fn().mockResolvedValue(undefined);

    const result = await sendSetGroupCard({
      session: {
        platform: "onebot",
        channelId: "group-1",
        bot: { internal: { setGroupCard } },
      } as any,
      userId: "user-1",
      card: "新名片",
    });

    expect(setGroupCard).toHaveBeenCalledWith({
      group_id: "group-1",
      user_id: "user-1",
      card: "新名片",
    });
    expect(result).toBe("群昵称已更新：user-1 -> 新名片");
  });
});

describe("createSetGroupCardTool", () => {
  it("创建可调用的群昵称工具", () => {
    const tool = createSetGroupCardTool({
      ctx: {} as any,
      toolName: "set_group_card",
      description: "desc",
    });

    expect(tool.name).toBe("set_group_card");
    expect(typeof tool.invoke).toBe("function");
  });
});
