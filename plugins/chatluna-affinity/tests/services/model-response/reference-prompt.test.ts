/**
 * Character XML 参考提示词注入测试
 * 覆盖默认关闭、scope 替换、互斥与依赖缺失保护
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { SystemMessage } = require("@langchain/core/messages");

const { registerCharacterPromptInjection } = require("../../../lib/index.js");

function createConfig(overrides = {}) {
  return {
    scopeId: "nene",
    xmlToolSettings: {
      injectXmlToolAsReplyTool: false,
      enableAffinityXmlToolCall: true,
      enableBlacklistXmlToolCall: true,
      enableRelationshipXmlToolCall: true,
      enableUserAliasXmlToolCall: true,
      autoInjectReferencePrompt: false,
      characterPromptTemplate:
        "当前作用域：{scopeId}\n动作示例：<affinity scopeId=\"{scopeId}\" />",
      ...overrides,
    },
  };
}

function createContext(pipeline) {
  return {
    chatluna: {
      contextManager: { pipeline },
    },
  };
}

test("默认关闭时不注册提示词管线", () => {
  let called = false;
  const dispose = registerCharacterPromptInjection({
    ctx: createContext(() => {
      called = true;
    }),
    config: createConfig(),
  });

  assert.equal(dispose, null);
  assert.equal(called, false);
});

test("开启后替换 scopeId 并作为系统消息注入", async () => {
  let registered;
  const disposer = () => {};
  const dispose = registerCharacterPromptInjection({
    ctx: createContext((stage, middleware, priority) => {
      registered = { stage, middleware, priority };
      return disposer;
    }),
    config: createConfig({ autoInjectReferencePrompt: true }),
    replaceScopeId: true,
  });

  assert.equal(dispose, disposer);
  assert.equal(registered.stage, "after_system_prompts");
  assert.equal(registered.priority, 0);

  const expectedPrompt =
    '当前作用域：nene\n动作示例：<affinity scopeId="nene" />';
  const runtime = {
    result: [],
    usedTokens: 3,
    tokenCounter: async (text) => {
      assert.equal(text, expectedPrompt);
      return 4;
    },
  };
  let nextCalled = false;
  await registered.middleware(runtime, async () => {
    nextCalled = true;
  });

  assert.equal(runtime.result.length, 1);
  assert.ok(runtime.result[0] instanceof SystemMessage);
  assert.equal(runtime.result[0].content, expectedPrompt);
  assert.equal(runtime.usedTokens, 7);
  assert.equal(nextCalled, true);
});

test("多 scope 模式不替换占位符但仍注入提示词", async () => {
  let middleware;
  registerCharacterPromptInjection({
    ctx: createContext((_, handler) => {
      middleware = handler;
      return () => {};
    }),
    config: createConfig({ autoInjectReferencePrompt: true }),
    replaceScopeId: false,
  });

  const expectedPrompt =
    '当前作用域：{scopeId}\n动作示例：<affinity scopeId="{scopeId}" />';
  const runtime = {
    result: [],
    usedTokens: 0,
    tokenCounter: async (text) => {
      assert.equal(text, expectedPrompt);
      return 2;
    },
  };
  await middleware(runtime, async () => {});

  assert.equal(runtime.result[0].content, expectedPrompt);
  assert.equal(runtime.usedTokens, 2);
});

test("实验性工具调用回复开启后跳过自动注入", () => {
  const logs = [];
  let called = false;
  const dispose = registerCharacterPromptInjection({
    ctx: createContext(() => {
      called = true;
    }),
    config: createConfig({
      autoInjectReferencePrompt: true,
      injectXmlToolAsReplyTool: true,
    }),
    log: (...args) => logs.push(args),
  });

  assert.equal(dispose, null);
  assert.equal(called, false);
  assert.deepEqual(logs.at(-1), [
    "debug",
    "已启用实验性工具调用回复，跳过 Character XML 参考提示词自动注入",
  ]);
});

test("提示词为空或上下文管理器缺失时安全跳过", () => {
  let called = false;
  const emptyDispose = registerCharacterPromptInjection({
    ctx: createContext(() => {
      called = true;
    }),
    config: createConfig({
      autoInjectReferencePrompt: true,
      characterPromptTemplate: "   ",
    }),
  });
  assert.equal(emptyDispose, null);
  assert.equal(called, false);

  const logs = [];
  const missingDispose = registerCharacterPromptInjection({
    ctx: {},
    config: createConfig({ autoInjectReferencePrompt: true }),
    log: (...args) => logs.push(args),
  });
  assert.equal(missingDispose, null);
  assert.deepEqual(logs.at(-1), [
    "warn",
    "Character XML 参考提示词自动注入失败：ChatLuna 上下文管理器不可用",
  ]);
});
