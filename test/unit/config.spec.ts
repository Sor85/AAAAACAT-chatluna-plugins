/**
 * 配置模块单元测试
 * 验证 Schema 分组结构与关键默认值定义
 */
import { describe, expect, it, vi } from "vitest";

const { objectCalls, intersectCalls } = vi.hoisted(() => ({
  objectCalls: [] as Array<Record<string, unknown>>,
  intersectCalls: [] as Array<unknown[]>,
}));

vi.mock("koishi", () => {
  const createChain = () => ({
    default() {
      return this;
    },
    description() {
      return this;
    },
    role() {
      return this;
    },
    min() {
      return this;
    },
    max() {
      return this;
    },
    step() {
      return this;
    },
  });

  return {
    Schema: {
      object: (shape: Record<string, unknown>) => {
        objectCalls.push(shape);
        return createChain();
      },
      intersect: (schemas: unknown[]) => {
        intersectCalls.push(schemas);
        return createChain();
      },
      dynamic: () => createChain(),
      boolean: () => createChain(),
      string: () => createChain(),
      number: () => createChain(),
    },
  };
});

import {
  Config,
  DEFAULT_GOOGLE_SEARCH_NAME,
  DEFAULT_URL_CONTEXT_NAME,
} from "../../src/config";

describe("config schema", () => {
  it("应按基础设置、Google Search、URL Context 三组构造 Schema", () => {
    expect(Config).toBeTruthy();
    expect(intersectCalls).toHaveLength(1);
    expect(intersectCalls[0]).toHaveLength(3);
    expect(objectCalls).toHaveLength(3);
  });

  it("基础设置分组应包含模型、调试和超时配置", () => {
    const baseGroup = objectCalls[0];

    expect(baseGroup).toHaveProperty("toolModel");
    expect(baseGroup).toHaveProperty("debug");
    expect(baseGroup).toHaveProperty("requestTimeoutMs");
  });

  it("Google Search 分组应包含开关、名称、描述、提示词和查询长度", () => {
    const googleGroup = objectCalls[1];

    expect(googleGroup).toHaveProperty("enableGoogleSearchTool");
    expect(googleGroup).toHaveProperty("googleSearchToolName");
    expect(googleGroup).toHaveProperty("googleSearchDescription");
    expect(googleGroup).toHaveProperty("googleSearchPrompt");
    expect(googleGroup).toHaveProperty("maxQueryLength");
    expect(DEFAULT_GOOGLE_SEARCH_NAME).toBe("google_search");
  });

  it("URL Context 分组应包含开关、名称、描述、提示词和 URL 长度", () => {
    const urlContextGroup = objectCalls[2];

    expect(urlContextGroup).toHaveProperty("enableUrlContextTool");
    expect(urlContextGroup).toHaveProperty("urlContextToolName");
    expect(urlContextGroup).toHaveProperty("urlContextDescription");
    expect(urlContextGroup).toHaveProperty("urlContextPrompt");
    expect(urlContextGroup).toHaveProperty("maxUrlLength");
    expect(DEFAULT_URL_CONTEXT_NAME).toBe("url_context");
  });
});
