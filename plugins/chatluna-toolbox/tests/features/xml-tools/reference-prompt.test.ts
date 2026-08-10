/**
 * XML 参考提示词注入测试
 * 覆盖默认关闭、系统消息注入和异常配置保护
 */

import { SystemMessage } from "@langchain/core/messages";
import { describe, expect, it, vi } from "vitest";
import { registerReferencePromptInjection } from "../../../src/features/xml-tools/reference-prompt";
import type { Config } from "../../../src/types";

function createConfig(overrides: Partial<Config> = {}): Config {
  return {
    autoInjectReferencePrompt: false,
    referencePrompt: "动作提示词",
    ...overrides,
  } as Config;
}

function createContext(pipeline = vi.fn()) {
  return {
    chatluna: {
      contextManager: { pipeline },
    },
  } as never;
}

describe("registerReferencePromptInjection", () => {
  it("默认关闭时不注册提示词管线", () => {
    const pipeline = vi.fn();

    const dispose = registerReferencePromptInjection({
      ctx: createContext(pipeline),
      config: createConfig(),
    });

    expect(dispose).toBeNull();
    expect(pipeline).not.toHaveBeenCalled();
  });

  it("开启后在系统提示词阶段后注入一次完整参考提示词", async () => {
    const disposer = vi.fn();
    const pipeline = vi.fn().mockReturnValue(disposer);
    const log = vi.fn();

    const dispose = registerReferencePromptInjection({
      ctx: createContext(pipeline),
      config: createConfig({
        autoInjectReferencePrompt: true,
        referencePrompt: "  动作提示词  ",
      }),
      log,
    });

    expect(dispose).toBe(disposer);
    expect(pipeline).toHaveBeenCalledWith(
      "after_system_prompts",
      expect.any(Function),
      0,
    );

    const middleware = pipeline.mock.calls[0][1];
    const next = vi.fn().mockResolvedValue(undefined);
    const tokenCounter = vi.fn().mockResolvedValue(5);
    const runtime = { result: [], usedTokens: 10, tokenCounter };

    await middleware(runtime, next);

    expect(runtime.result).toHaveLength(1);
    expect(runtime.result[0]).toBeInstanceOf(SystemMessage);
    expect((runtime.result[0] as SystemMessage).content).toBe("动作提示词");
    expect(tokenCounter).toHaveBeenCalledWith("动作提示词");
    expect(runtime.usedTokens).toBe(15);
    expect(next).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("info", "XML 参考提示词自动注入已启用");
  });

  it("启用实验性工具调用回复后不再自动注入参考提示词", () => {
    const pipeline = vi.fn();
    const log = vi.fn();

    const dispose = registerReferencePromptInjection({
      ctx: createContext(pipeline),
      config: createConfig({
        autoInjectReferencePrompt: true,
        injectXmlToolAsReplyTool: true,
      }),
      log,
    });

    expect(dispose).toBeNull();
    expect(pipeline).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "debug",
      "已启用实验性工具调用回复，跳过 XML 参考提示词自动注入",
    );
  });

  it("提示词为空白时不注册管线", () => {
    const pipeline = vi.fn();

    registerReferencePromptInjection({
      ctx: createContext(pipeline),
      config: createConfig({
        autoInjectReferencePrompt: true,
        referencePrompt: "   ",
      }),
    });

    expect(pipeline).not.toHaveBeenCalled();
  });

  it("上下文管理器不可用时记录警告并安全跳过", () => {
    const log = vi.fn();

    const dispose = registerReferencePromptInjection({
      ctx: {} as never,
      config: createConfig({ autoInjectReferencePrompt: true }),
      log,
    });

    expect(dispose).toBeNull();
    expect(log).toHaveBeenCalledWith(
      "warn",
      "XML 参考提示词自动注入失败：ChatLuna 上下文管理器不可用",
    );
  });
});
