/**
 * 个人资料工具测试
 * 覆盖资料修改接口与协议差异
 */

import { describe, expect, it, vi } from "vitest";
import { createSetProfileTool, sendSetProfile } from "../../../../src/features/native-tools/tools/profile";

describe("sendSetProfile", () => {
  it("NapCat 调用 set_qq_profile 并包含性别字段", async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    const result = await sendSetProfile({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      nickname: "新昵称",
      signature: "新签名",
      gender: "female",
      protocol: "napcat",
    });

    expect(request).toHaveBeenCalledWith("set_qq_profile", {
      nickname: "新昵称",
      personal_note: "新签名",
      sex: "2",
    });
    expect(result).toBe("机器人资料已更新。");
  });

  it("LLBot 修改资料时不发送性别字段", async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    await sendSetProfile({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      nickname: "新昵称",
      gender: "male",
      protocol: "llbot",
    });

    expect(request).toHaveBeenCalledWith("set_qq_profile", {
      nickname: "新昵称",
    });
  });
});

describe("createSetProfileTool", () => {
  it("创建可调用的资料工具", () => {
    const tool = createSetProfileTool({
      ctx: {} as any,
      toolName: "set_self_profile",
      description: "desc",
      protocol: "napcat",
    });

    expect(tool.name).toBe("set_self_profile");
    expect(typeof tool.invoke).toBe("function");
  });
});
