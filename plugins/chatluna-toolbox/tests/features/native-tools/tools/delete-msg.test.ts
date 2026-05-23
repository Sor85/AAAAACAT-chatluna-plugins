/**
 * 消息撤回工具测试
 * 覆盖 OneBot 调用与 ChatLuna 入参兼容
 */

import { describe, expect, it, vi } from "vitest";
import { createDeleteMessageTool, sendDeleteMessage } from "../../../../src/features/native-tools/tools/delete-msg";

function createOneBotSession() {
  const request = vi.fn().mockResolvedValue(undefined);
  return {
    session: {
      platform: "onebot",
      bot: { internal: { _request: request } },
    } as any,
    request,
  };
}

describe("sendDeleteMessage", () => {
  it("调用 delete_msg 接口撤回消息", async () => {
    const { session, request } = createOneBotSession();

    const result = await sendDeleteMessage({
      session,
      message_id: "12345",
    });

    expect(request).toHaveBeenCalledWith("delete_msg", {
      message_id: 12345,
    });
    expect(result).toBe("Message deleted by ID 12345.");
  });

  it("在没有 _request 时回退到 deleteMsg", async () => {
    const deleteMsg = vi.fn().mockResolvedValue(undefined);

    const result = await sendDeleteMessage({
      session: {
        platform: "onebot",
        bot: { internal: { deleteMsg } },
      } as any,
      message_id: "abc",
    });

    expect(deleteMsg).toHaveBeenCalledWith({ message_id: "abc" });
    expect(result).toBe("Message deleted by ID abc.");
  });

  it("返回 OneBot 失败包时报告失败原因", async () => {
    const request = vi.fn().mockResolvedValue({
      status: "failed",
      retcode: 1404,
      wording: "message not found",
    });

    const result = await sendDeleteMessage({
      session: {
        platform: "onebot",
        bot: { internal: { _request: request } },
      } as any,
      message_id: "12345",
    });

    expect(result).toBe("delete_msg failed: message not found (retcode: 1404)");
  });
});

describe("createDeleteMessageTool", () => {
  it("创建可调用的撤回工具", async () => {
    const tool = createDeleteMessageTool({
      toolName: "delete_msg",
      description: "desc",
    });

    expect(tool.name).toBe("delete_msg");
    expect(typeof tool.invoke).toBe("function");
  });

  it("只暴露 message_id 入参", async () => {
    const { session, request } = createOneBotSession();
    const tool = createDeleteMessageTool({
      toolName: "delete_msg",
      description: "desc",
    });

    expect((tool as any).schema.safeParse({ messageId: "12345" }).success).toBe(
      false,
    );
    expect((tool as any).schema.safeParse({ message_id: "12345" }).success).toBe(
      true,
    );

    const result = await (tool as any)._call(
      { message_id: "12345" },
      undefined,
      { configurable: { session } },
    );

    expect(request).toHaveBeenCalledWith("delete_msg", {
      message_id: 12345,
    });
    expect(result).toBe("Message deleted by ID 12345.");
  });
});
