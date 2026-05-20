/**
 * temp-runtime 测试
 * 覆盖消息拦截、文本提取与恢复行为
 */

import { describe, expect, it, vi } from "vitest";
import { createCharacterTempXmlRuntime } from "../../../src/features/xml-tools/temp-runtime";

describe("createCharacterTempXmlRuntime", () => {
  it("从 assistant 消息中提取文本并交给处理器", async () => {
    const temp = { completionMessages: [] as unknown[] };
    const session = { platform: "onebot", guildId: "group-1" } as any;
    const processModelResponse = vi.fn().mockResolvedValue(true);
    const service = {
      getTemp: vi.fn(async () => temp),
    };

    const runtime = createCharacterTempXmlRuntime({
      getCharacterService: () => service,
      processModelResponse,
    });

    runtime.start();
    const currentTemp = await (service.getTemp as any)(session);
    currentTemp.completionMessages?.push({
      role: "assistant",
      content: '<actions><poke id="u1"/></actions>',
    });
    await Promise.resolve();

    expect(processModelResponse).toHaveBeenCalledTimes(1);
    expect(processModelResponse).toHaveBeenCalledWith({
      response: '<actions><poke id="u1"/></actions>',
      session,
    });
  });

  it("忽略非 assistant/ai 消息", async () => {
    const temp = { completionMessages: [] as unknown[] };
    const processModelResponse = vi.fn().mockResolvedValue(true);
    const service = {
      getTemp: vi.fn(async () => temp),
    };

    const runtime = createCharacterTempXmlRuntime({
      getCharacterService: () => service,
      processModelResponse,
    });

    runtime.start();
    const currentTemp = await (service.getTemp as any)({} as any);
    currentTemp.completionMessages?.push({ role: "user", content: "hello" });
    await Promise.resolve();

    expect(processModelResponse).not.toHaveBeenCalled();
  });

  it("兼容从 children 与 attrs 提取文本", async () => {
    const temp = { completionMessages: [] as unknown[] };
    const processModelResponse = vi.fn().mockResolvedValue(true);
    const service = {
      getTemp: vi.fn(async () => temp),
    };

    const runtime = createCharacterTempXmlRuntime({
      getCharacterService: () => service,
      processModelResponse,
    });

    runtime.start();
    const currentTemp = await (service.getTemp as any)({ userId: "1" } as any);
    currentTemp.completionMessages?.push({
      type: "ai",
      content: [
        {
          children: [
            { text: "<actions>" },
            { text: '<delete message_id="m1"/>' },
          ],
        },
        { attrs: { text: "</actions>" } },
      ],
    });
    await Promise.resolve();

    expect(processModelResponse).toHaveBeenCalledWith({
      response: '<actions><delete message_id="m1"/></actions>',
      session: { userId: "1" },
    });
  });

  it("停止后恢复原始 getTemp 且不再处理新消息", async () => {
    const temp = { completionMessages: [] as unknown[] };
    const processModelResponse = vi.fn().mockResolvedValue(true);
    const originalGetTemp = vi.fn(async () => temp);
    const service = {
      getTemp: originalGetTemp,
    };

    const runtime = createCharacterTempXmlRuntime({
      getCharacterService: () => service,
      processModelResponse,
    });

    runtime.start();
    const currentTemp = await (service.getTemp as any)({ userId: "1" } as any);
    runtime.stop();
    currentTemp.completionMessages?.push({
      role: "assistant",
      content: '<actions><poke id="u1"/></actions>',
    });
    await Promise.resolve();

    expect(service.getTemp).toBe(originalGetTemp);
    expect(processModelResponse).not.toHaveBeenCalled();
  });

  it("多个 runtime 共用同一 service 时，停止旧实例不影响新实例", async () => {
    const temp = { completionMessages: [] as unknown[] };
    const processA = vi.fn().mockResolvedValue(true);
    const processB = vi.fn().mockResolvedValue(true);
    const service = {
      getTemp: vi.fn(async () => temp),
    };

    const runtimeA = createCharacterTempXmlRuntime({
      getCharacterService: () => service,
      processModelResponse: processA,
    });
    const runtimeB = createCharacterTempXmlRuntime({
      getCharacterService: () => service,
      processModelResponse: processB,
    });

    runtimeA.start();
    runtimeB.start();
    const currentTemp = await (service.getTemp as any)({ userId: "1" } as any);

    runtimeA.stop();
    currentTemp.completionMessages?.push({
      role: "assistant",
      content: '<actions><poke id="u1"/></actions>',
    });
    await Promise.resolve();

    expect(processA).not.toHaveBeenCalled();
    expect(processB).toHaveBeenCalledTimes(1);
  });
});
