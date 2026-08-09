/**
 * 好友与群申请处理工具测试
 * 覆盖好友申请、加群申请、群邀请与 OneBot 失败响应
 */

import { describe, expect, it, vi } from "vitest";
import {
  createHandleRequestTool,
  sendHandleRequest,
} from "../../../../src/features/native-tools/tools/handle-request";

describe("sendHandleRequest", () => {
  it("同意好友申请", async () => {
    const request = vi.fn().mockResolvedValue({ status: "ok", retcode: 0 });
    const result = await sendHandleRequest({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      requestType: "friend",
      flag: "friend-flag",
      approve: true,
      remark: "新朋友",
    });

    expect(request).toHaveBeenCalledWith("set_friend_add_request", {
      flag: "friend-flag",
      approve: true,
      remark: "新朋友",
    });
    expect(result).toBe("已同意好友申请 friend-flag。");
  });

  it("拒绝加群申请", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const result = await sendHandleRequest({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      requestType: "group",
      flag: "group-add-flag",
      subType: "add",
      approve: false,
      reason: "暂不接受",
    });

    expect(request).toHaveBeenCalledWith("set_group_add_request", {
      flag: "group-add-flag",
      sub_type: "add",
      approve: false,
      reason: "暂不接受",
    });
    expect(result).toBe("已拒绝加群申请 group-add-flag。");
  });

  it("同意群邀请并回退到适配器方法", async () => {
    const setGroupAddRequest = vi.fn().mockResolvedValue(undefined);
    const result = await sendHandleRequest({
      session: {
        platform: "onebot",
        bot: { internal: { setGroupAddRequest } },
      } as any,
      requestType: "group",
      flag: "group-invite-flag",
      subType: "invite",
      approve: true,
    });

    expect(setGroupAddRequest).toHaveBeenCalledWith({
      flag: "group-invite-flag",
      sub_type: "invite",
      approve: true,
      reason: "",
    });
    expect(result).toBe("已同意群邀请 group-invite-flag。");
  });

  it("群申请缺少 subType 时返回参数错误", async () => {
    const request = vi.fn();
    const result = await sendHandleRequest({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      requestType: "group",
      flag: "group-flag",
      approve: true,
    });

    expect(request).not.toHaveBeenCalled();
    expect(result).toBe(
      "subType is required for group requests; use add or invite.",
    );
  });

  it("申请 flag 为空时返回参数错误", async () => {
    const request = vi.fn();
    const result = await sendHandleRequest({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      requestType: "friend",
      flag: "   ",
      approve: true,
    });

    expect(request).not.toHaveBeenCalled();
    expect(result).toBe("request flag is required.");
  });

  it("OneBot 返回失败响应时不应报告处理成功", async () => {
    const request = vi.fn().mockResolvedValue({
      status: "failed",
      retcode: 1404,
      wording: "request not found",
    });
    const result = await sendHandleRequest({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      requestType: "friend",
      flag: "expired-flag",
      approve: true,
    });

    expect(result).toBe(
      "handle_request failed: request not found (retcode: 1404)",
    );
  });
});

describe("createHandleRequestTool", () => {
  it("创建可调用的好友与群申请处理工具", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const tool = createHandleRequestTool({
      toolName: "custom_handle_request",
      description: "desc",
    });

    const result = await tool.invoke(
      {
        requestType: "friend",
        flag: "friend-flag",
        approve: false,
      },
      {
        configurable: {
          session: {
            platform: "onebot",
            bot: { internal: { _request: request } },
          },
        },
      },
    );

    expect(tool.name).toBe("custom_handle_request");
    expect(tool.description).toBe("desc");
    expect(request).toHaveBeenCalledWith("set_friend_add_request", {
      flag: "friend-flag",
      approve: false,
      remark: "",
    });
    expect(result).toBe("已拒绝好友申请 friend-flag。");
  });
});
