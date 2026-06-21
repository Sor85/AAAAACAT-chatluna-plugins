/**
 * 群成员搜索工具测试
 * 覆盖昵称搜索、qqid 查询与群号解析
 */

import { describe, expect, it, vi } from "vitest";
import {
  createSearchGroupMemberTool,
  searchGroupMember,
} from "../../../../src/features/native-tools/tools/search-group-member";

describe("searchGroupMember", () => {
  it("根据群昵称或 QQ 昵称搜索群成员", async () => {
    const request = vi.fn().mockResolvedValue([
      { user_id: 10001, card: "阿猫", nickname: "AAAAACAT" },
      { user_id: 10002, card: "普通成员", nickname: "猫猫" },
      { user_id: 10003, card: "无关成员", nickname: "Dog" },
    ]);

    const result = await searchGroupMember({
      session: {
        platform: "onebot",
        guildId: "123456",
        bot: { internal: { _request: request } },
      } as any,
      query: "猫",
    });

    expect(request).toHaveBeenCalledWith("get_group_member_list", {
      group_id: 123456,
    });
    expect(result).toBe(
      [
        "找到 2 个匹配成员：",
        "1. qqid：10001，群昵称：阿猫，QQ昵称：AAAAACAT",
        "2. qqid：10002，群昵称：普通成员，QQ昵称：猫猫",
      ].join("\n"),
    );
  });

  it("默认将纯数字 query 按 qqid 精确查询", async () => {
    const request = vi.fn().mockResolvedValue([
      { user_id: 10001, card: "123", nickname: "数字昵称" },
      { user_id: 123, card: "目标成员", nickname: "Target" },
    ]);

    const result = await searchGroupMember({
      session: {
        platform: "onebot",
        guildId: "123456",
        bot: { internal: { _request: request } },
      } as any,
      query: "123",
    });

    expect(result).toBe(
      ["找到 1 个匹配成员：", "1. qqid：123，群昵称：目标成员，QQ昵称：Target"].join(
        "\n",
      ),
    );
  });

  it("mode 为 byName 时允许搜索纯数字昵称", async () => {
    const request = vi.fn().mockResolvedValue([
      { user_id: 10001, card: "123", nickname: "数字昵称" },
      { user_id: 123, card: "目标成员", nickname: "Target" },
    ]);

    const result = await searchGroupMember({
      session: {
        platform: "onebot",
        guildId: "123456",
        bot: { internal: { _request: request } },
      } as any,
      query: "123",
      mode: "byName",
    });

    expect(result).toBe(
      ["找到 1 个匹配成员：", "1. qqid：10001，群昵称：123，QQ昵称：数字昵称"].join(
        "\n",
      ),
    );
  });

  it("在私聊中允许通过 groupId 查询指定群", async () => {
    const request = vi.fn().mockResolvedValue([
      { user_id: 10001, card: "阿猫", nickname: "AAAAACAT" },
    ]);

    const result = await searchGroupMember({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      groupId: "123456",
      query: "10001",
    });

    expect(request).toHaveBeenCalledWith("get_group_member_list", {
      group_id: 123456,
    });
    expect(result).toContain("qqid：10001，群昵称：阿猫，QQ昵称：AAAAACAT");
  });

  it("没有群号时返回错误", async () => {
    const result = await searchGroupMember({
      session: {
        platform: "onebot",
        bot: { internal: { _request: vi.fn() } },
      } as any,
      query: "阿猫",
    });

    expect(result).toBe(
      "Missing groupId. Provide groupId explicitly or run inside a group session.",
    );
  });

  it("匹配超过 10 条时只返回前 10 条", async () => {
    const request = vi.fn().mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => ({
        user_id: 10000 + index,
        card: `猫${index}`,
        nickname: `Cat${index}`,
      })),
    );

    const result = await searchGroupMember({
      session: {
        platform: "onebot",
        guildId: "123456",
        bot: { internal: { _request: request } },
      } as any,
      query: "猫",
    });

    expect(result).toContain("仅显示前 10 条，共 11 条匹配：");
    expect(result).toContain("10. qqid：10009");
    expect(result).not.toContain("11. qqid：10010");
  });

  it("在没有 _request 时回退到 getGroupMemberList", async () => {
    const getGroupMemberList = vi.fn().mockResolvedValue([
      { user_id: 10001, card: "阿猫", nickname: "AAAAACAT" },
    ]);

    const result = await searchGroupMember({
      session: {
        platform: "onebot",
        guildId: "123456",
        bot: { internal: { getGroupMemberList } },
      } as any,
      query: "阿猫",
    });

    expect(getGroupMemberList).toHaveBeenCalledWith(123456);
    expect(result).toContain("qqid：10001，群昵称：阿猫，QQ昵称：AAAAACAT");
  });
});

describe("createSearchGroupMemberTool", () => {
  it("创建可调用的群成员搜索工具", () => {
    const tool = createSearchGroupMemberTool({
      toolName: "search_group_member",
      description: "desc",
    });

    expect(tool.name).toBe("search_group_member");
    expect(tool.description).toBe("desc");
    expect(typeof tool.invoke).toBe("function");
  });
});
