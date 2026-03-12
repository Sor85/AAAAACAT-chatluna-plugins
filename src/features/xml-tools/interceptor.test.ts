import { describe, expect, it, vi } from "vitest";
import { createXmlInterceptor } from "./interceptor";

/**
 * XML 拦截器测试
 * 覆盖模型响应日志前缀兼容性
 */

describe("createXmlInterceptor", () => {
  it.each(["model response: <tool_call />", "model response:\n<tool_call />"])(
    "兼容日志前缀 %s",
    async (message) => {
      const session = { guildId: "group-1" } as any;
      let collector: ((session: any) => Promise<void>) | undefined;
      const debug = vi.fn();
      const characterService = {
        collect: vi.fn((callback) => {
          collector = callback;
        }),
        logger: { debug },
      };
      const timeouts: Array<() => void> = [];
      const intervals: Array<() => void> = [];
      const onResponse = vi.fn(() => true);
      const ctx = {
        chatluna_character: characterService,
        setTimeout: vi.fn((callback: () => void) => {
          timeouts.push(callback);
          return () => {
            const index = timeouts.indexOf(callback);
            if (index >= 0) timeouts.splice(index, 1);
          };
        }),
        setInterval: vi.fn((callback: () => void) => {
          intervals.push(callback);
          return () => {
            const index = intervals.indexOf(callback);
            if (index >= 0) intervals.splice(index, 1);
          };
        }),
      } as any;

      const interceptor = createXmlInterceptor({
        ctx,
        config: { debugLogging: false } as any,
        onResponse,
      });

      interceptor.start();
      expect(timeouts).toHaveLength(1);
      timeouts.shift()?.();
      await collector?.(session);

      characterService.logger.debug?.(message);

      expect(onResponse).toHaveBeenCalledTimes(1);
      expect(onResponse).toHaveBeenCalledWith("<tool_call />", session);

      interceptor.stop();
    },
  );
});
