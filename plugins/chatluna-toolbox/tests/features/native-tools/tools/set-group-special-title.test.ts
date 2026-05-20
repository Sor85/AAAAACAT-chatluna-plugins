/**
 * 群成员专属头衔工具测试
 * 覆盖参数校验与 OneBot 调用行为
 */

import { describe, expect, it, vi } from "vitest";
import {
  createSetGroupSpecialTitleTool,
  sendSetGroupSpecialTitle,
} from "../../../../src/features/native-tools/tools/set-group-special-title";

describe("sendSetGroupSpecialTitle", () => {
  it("调用 set_group_special_title 接口修改群成员专属头衔", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const result = await sendSetGroupSpecialTitle({
      session: {
        platform: "onebot",
        guildId: "group-1",
        bot: { internal: { _request: request } },
      } as any,
      userId: "user-1",
      title: "测试头衔",
      protocol: "napcat",
    });

    expect(request).toHaveBeenCalledWith("set_group_special_title", {
      group_id: "group-1",
      user_id: "user-1",
      special_title: "测试头衔",
    });
    expect(result).toBe("群专属头衔已更新：user-1 -> 测试头衔");
  });

  it("允许 title 为空字符串以清除专属头衔", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const result = await sendSetGroupSpecialTitle({
      session: {
        platform: "onebot",
        guildId: "group-1",
        bot: { internal: { _request: request } },
      } as any,
      userId: "user-1",
      title: "   ",
      protocol: "llbot",
    });

    expect(request).toHaveBeenCalledWith("set_group_special_title", {
      group_id: "group-1",
      user_id: "user-1",
      special_title: "",
    });
    expect(result).toBe("群专属头衔已清除：user-1");
  });

  it("在缺少群号时返回错误", async () => {
    const result = await sendSetGroupSpecialTitle({
      session: {
        platform: "onebot",
        bot: { internal: { _request: vi.fn() } },
      } as any,
      userId: "user-1",
      title: "测试头衔",
      protocol: "napcat",
    });

    expect(result).toBe(
      "Missing groupId. Provide groupId explicitly or run inside a group session.",
    );
  });

  it("在没有 _request 时回退到 setGroupSpecialTitle", async () => {
    const setGroupSpecialTitle = vi.fn().mockResolvedValue(undefined);
    const result = await sendSetGroupSpecialTitle({
      session: {
        platform: "onebot",
        guildId: "group-1",
        bot: { internal: { setGroupSpecialTitle } },
      } as any,
      userId: "user-1",
      title: "LL 头衔",
      protocol: "llbot",
    });

    expect(setGroupSpecialTitle).toHaveBeenCalledWith({
      group_id: "group-1",
      user_id: "user-1",
      special_title: "LL 头衔",
    });
    expect(result).toBe("群专属头衔已更新：user-1 -> LL 头衔");
  });
});

describe("createSetGroupSpecialTitleTool", () => {
  it("创建默认专属头衔工具", async () => {
    const tool = createSetGroupSpecialTitleTool({
      toolName: "set_group_special_title",
      description: "desc",
      protocol: "napcat",
    });

    expect(tool.name).toBe("set_group_special_title");
    expect(tool.description).toBe("desc");

    const result = await (tool as any)._call(
      { userId: "user-1", title: "测试头衔" },
      undefined,
      {
        configurable: {
          session: {
            platform: "onebot",
            guildId: "group-1",
            bot: {
              internal: { _request: vi.fn().mockResolvedValue(undefined) },
            },
          },
        },
      },
    );

    expect(result).toBe("群专属头衔已更新：user-1 -> 测试头衔");
  });
});
