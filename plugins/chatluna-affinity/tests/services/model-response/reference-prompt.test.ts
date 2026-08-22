/**
 * Character 系统提示词注入测试
 * 验证 XML 参考提示词与好感度机制说明相互独立
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { SystemMessage } = require("@langchain/core/messages");

const {
  registerCharacterPromptInjection,
  registerAffinityMechanismPromptInjection,
} = require("../../../lib/index.js");

function createConfig(overrides = {}) {
  return {
    scopeId: "nene",
    autoInjectAffinityMechanismPrompt: true,
    affinityDynamics: {
      disableShortTermAffinity: false,
      disableAffinityCoefficient: false,
    },
    xmlToolSettings: {
      injectXmlToolAsReplyTool: false,
      enableAffinityXmlToolCall: true,
      enableBlacklistXmlToolCall: true,
      enableRelationshipXmlToolCall: true,
      enableUserAliasXmlToolCall: true,
      autoInjectReferencePrompt: false,
      characterPromptTemplate:
        "当前作用域：{scopeId}\n动作示例：<affinity scopeId=\"{scopeId}\" />",
    },
    ...overrides,
  };
}

function createContext(pipeline) {
  return {
    chatluna: {
      contextManager: { pipeline },
    },
  };
}

test("XML 提示词默认关闭且不会混入好感度机制说明", async () => {
  let called = false;
  const disabled = registerCharacterPromptInjection({
    ctx: createContext(() => {
      called = true;
    }),
    config: createConfig(),
  });
  assert.equal(disabled, null);
  assert.equal(called, false);

  let registered;
  registerCharacterPromptInjection({
    ctx: createContext((stage, middleware, priority) => {
      registered = { stage, middleware, priority };
      return () => {};
    }),
    config: createConfig({
      xmlToolSettings: {
        ...createConfig().xmlToolSettings,
        autoInjectReferencePrompt: true,
      },
    }),
    replaceScopeId: true,
  });

  const expectedPrompt =
    '当前作用域：nene\n动作示例：<affinity scopeId="nene" />';
  const runtime = {
    result: [],
    usedTokens: 0,
    tokenCounter: async (text) => {
      assert.equal(text, expectedPrompt);
      return 2;
    },
  };
  await registered.middleware(runtime, async () => {});

  assert.equal(registered.stage, "after_system_prompts");
  assert.equal(registered.priority, 0);
  assert.ok(runtime.result[0] instanceof SystemMessage);
  assert.equal(runtime.result[0].content, expectedPrompt);
  assert.equal(runtime.usedTokens, 2);
});

test("XML 实验性工具模式只禁用 XML 提示词", () => {
  let called = false;
  const dispose = registerCharacterPromptInjection({
    ctx: createContext(() => {
      called = true;
    }),
    config: createConfig({
      xmlToolSettings: {
        ...createConfig().xmlToolSettings,
        autoInjectReferencePrompt: true,
        injectXmlToolAsReplyTool: true,
      },
    }),
  });

  assert.equal(dispose, null);
  assert.equal(called, false);
});

test("好感度机制提示词默认独立开启，不依赖 XML 模式", async () => {
  let registered;
  const disposer = () => {};
  const dispose = registerAffinityMechanismPromptInjection({
    ctx: createContext((stage, middleware, priority) => {
      registered = { stage, middleware, priority };
      return disposer;
    }),
    config: createConfig({
      xmlToolSettings: {
        ...createConfig().xmlToolSettings,
        injectXmlToolAsReplyTool: true,
      },
    }),
  });

  assert.equal(dispose, disposer);
  const runtime = {
    result: [],
    usedTokens: 1,
    tokenCounter: async () => 3,
  };
  await registered.middleware(runtime, async () => {});

  assert.match(
    runtime.result[0].content,
    /^<available_affinity_mechanism>\n/,
  );
  assert.match(
    runtime.result[0].content,
    /\n<\/available_affinity_mechanism>$/,
  );
  assert.doesNotMatch(runtime.result[0].content, /<affinity\s/);
  assert.equal(runtime.usedTokens, 4);
});

test("好感度机制提示词可由独立开关关闭", () => {
  let called = false;
  const dispose = registerAffinityMechanismPromptInjection({
    ctx: createContext(() => {
      called = true;
    }),
    config: createConfig({ autoInjectAffinityMechanismPrompt: false }),
  });

  assert.equal(dispose, null);
  assert.equal(called, false);
});

test("提示词注入在上下文管理器缺失时安全跳过", () => {
  const logs = [];
  const xmlDispose = registerCharacterPromptInjection({
    ctx: {},
    config: createConfig({
      xmlToolSettings: {
        ...createConfig().xmlToolSettings,
        autoInjectReferencePrompt: true,
      },
    }),
    log: (...args) => logs.push(args),
  });
  const mechanismDispose = registerAffinityMechanismPromptInjection({
    ctx: {},
    config: createConfig(),
    log: (...args) => logs.push(args),
  });

  assert.equal(xmlDispose, null);
  assert.equal(mechanismDispose, null);
  assert.match(logs[0][1], /XML 参考提示词/);
  assert.match(logs[1][1], /好感度机制提示词/);
});
