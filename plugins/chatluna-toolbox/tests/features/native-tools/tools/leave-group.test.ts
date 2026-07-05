/**
 * 退群工具测试
 * 覆盖 OneBot 调用与适配器 fallback
 */

import { describe, expect, it, vi } from "vitest";
import { createLeaveGroupTool, sendLeaveGroup } from "../../../../src/features/native-tools/tools/leave-group";

describe("sendLeaveGroup", () => {
  it("调用 set_group_leave 接口退出当前群", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const result = await sendLeaveGroup({
      session: {
        platform: "onebot",
        guildId: "group-1",
        bot: { internal: { _request: request } },
      } as any,
    });

    expect(request).toHaveBeenCalledWith("set_group_leave", {
      group_id: "group-1",
    });
    expect(result).toBe("已退出群 group-1。");
  });

  it("在没有 _request 时回退到 setGroupLeave", async () => {
    const setGroupLeave = vi.fn().mockResolvedValue(undefined);
    const result = await sendLeaveGroup({
      session: {
        platform: "onebot",
        channelId: "group-1",
        bot: { internal: { setGroupLeave } },
      } as any,
    });

    expect(setGroupLeave).toHaveBeenCalledWith({
      group_id: "group-1",
    });
    expect(result).toBe("已退出群 group-1。");
  });

  it("在缺少群号时返回错误", async () => {
    const result = await sendLeaveGroup({
      session: {
        platform: "onebot",
        bot: { internal: { _request: vi.fn() } },
      } as any,
    });

    expect(result).toBe(
      "Missing groupId. Provide groupId explicitly or run inside a group session.",
    );
  });
});

describe("createLeaveGroupTool", () => {
  it("创建可调用的退群工具", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const tool = createLeaveGroupTool({
      toolName: "set_group_leave",
      description: "desc",
    });

    expect(tool.name).toBe("set_group_leave");
    expect(tool.description).toBe("desc");

    const result = await tool.invoke(
      {},
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

    expect(request).toHaveBeenCalledWith("set_group_leave", {
      group_id: "group-1",
    });
    expect(result).toBe("已退出群 group-1。");
  });
});
