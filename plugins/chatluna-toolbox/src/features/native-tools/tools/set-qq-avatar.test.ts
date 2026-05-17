import { describe, expect, it, vi } from "vitest";
import { createSetQQAvatarTool, sendSetQQAvatar } from "./set-qq-avatar";

function createOneBotSession() {
  const request = vi.fn(async () => ({}));
  return {
    platform: "onebot",
    bot: {
      internal: {
        _request: request,
      },
    },
  } as any;
}

describe("sendSetQQAvatar", () => {
  it("downloads HTTP images before sending base64 data to OneBot", async () => {
    const session = createOneBotSession();
    const httpGet = vi.fn(async () => Buffer.from("avatar"));

    const result = await sendSetQQAvatar({
      ctx: { http: { get: httpGet } } as any,
      session,
      imageUrl: "https://example.com/avatar.png",
    });

    expect(httpGet).toHaveBeenCalledWith("https://example.com/avatar.png", {
      responseType: "arraybuffer",
    });
    expect(session.bot.internal._request).toHaveBeenCalledWith(
      "set_qq_avatar",
      { file: `base64://${Buffer.from("avatar").toString("base64")}` },
    );
    expect(result).toBe("QQ 头像已更新。");
  });

  it("passes non-HTTP image references through to OneBot", async () => {
    const session = createOneBotSession();

    const result = await sendSetQQAvatar({
      session,
      imageUrl: "base64://YXZhdGFy",
    });

    expect(session.bot.internal._request).toHaveBeenCalledWith(
      "set_qq_avatar",
      { file: "base64://YXZhdGFy" },
    );
    expect(result).toBe("QQ 头像已更新。");
  });

  it("reports failed OneBot responses instead of returning success", async () => {
    const session = createOneBotSession();
    session.bot.internal._request.mockResolvedValueOnce({
      status: "failed",
      retcode: 1200,
      wording: "avatar image invalid",
    });

    const result = await sendSetQQAvatar({
      session,
      imageUrl: "base64://YXZhdGFy",
    });

    expect(result).toBe(
      "set_qq_avatar failed: avatar image invalid (retcode: 1200)",
    );
  });

  it("rejects blank image URLs before calling OneBot", async () => {
    const session = createOneBotSession();

    const result = await sendSetQQAvatar({
      session,
      imageUrl: "   ",
    });

    expect(session.bot.internal._request).not.toHaveBeenCalled();
    expect(result).toBe("imageUrl is required.");
  });
});

describe("createSetQQAvatarTool", () => {
  it("returns an invokable LangChain structured tool", () => {
    const tool = createSetQQAvatarTool({
      toolName: "set_qq_avatar",
      description: "desc",
    });

    expect(tool.name).toBe("set_qq_avatar");
    expect(typeof tool.invoke).toBe("function");
  });
});
