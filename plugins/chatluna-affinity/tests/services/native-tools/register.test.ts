/**
 * 原生工具注册测试
 * 覆盖默认关闭、注册配置与单用户工具执行行为
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { registerNativeTools } = require("../../../lib/index.js");

function createConfig(overrides = {}) {
  return {
    scopeId: "宁宁",
    affinityEnabled: true,
    affinityDisplayRange: 1,
    initialAffinity: 30,
    affinityDynamics: {},
    blacklistLogInterception: true,
    shortTermBlacklistPenalty: 5,
    unblockPermanentInitialAffinity: 10,
    rankDefaultLimit: 10,
    rankRenderAsImage: false,
    blacklistDefaultLimit: 10,
    inspectRenderAsImage: false,
    inspectShowImpression: false,
    debugLogging: false,
    blacklistRenderAsImage: false,
    shortTermBlacklistRenderAsImage: false,
    relationships: [],
    relationshipAffinityLevels: [],
    variableSettings: {
      affinityVariableName: "affinity",
      showChatCountInAffinityVariable: true,
      relationshipLevelVariableName: "relationshipLevel",
      blacklistListVariableName: "blacklistList",
    },
    nativeToolSettings: {
      enabledNativeTools: [],
      affinity: {
        toolName: "affinity_affinity",
        description: "调整一个用户的好感度。",
      },
      blacklist: {
        toolName: "affinity_blacklist",
        description: "新增或移除一个用户的黑名单。",
      },
      relationship: {
        toolName: "affinity_relationship",
        description: "设置或清空一个用户的关系。",
      },
      userAlias: {
        toolName: "affinity_user_alias",
        description: "设置一个用户的自定义昵称。",
      },
    },
    botSelfIds: [],
    xmlToolSettings: {
      injectXmlToolAsReplyTool: false,
      enableAffinityXmlToolCall: true,
      enableBlacklistXmlToolCall: true,
      enableRelationshipXmlToolCall: true,
      enableUserAliasXmlToolCall: true,
      characterPromptTemplate: "",
    },
    ...overrides,
  };
}

function createDeps(overrides = {}) {
  const calls = {
    tools: [],
    save: [],
    clear: [],
    removeTemporary: [],
    recordPermanent: [],
    recordTemporary: [],
    unblockPermanent: [],
    setAlias: [],
    load: [],
    ensureForSeed: [],
  };

  const deps = {
    ctx: {},
    config: createConfig(),
    plugin: {
      registerTool(name, tool) {
        calls.tools.push({ name, tool });
      },
    },
    cache: {
      clear(scopeId, userId) {
        calls.clear.push({ scopeId, userId });
      },
    },
    store: {
      async ensureForSeed(seed, userId) {
        calls.ensureForSeed.push({ seed, userId });
        return { longTermAffinity: 30, shortTermAffinity: 0 };
      },
      async recordInteraction() {
        return { ok: true };
      },
      async save(seed, value, relation) {
        calls.save.push({ seed, value, relation });
        return { ok: true };
      },
      clamp(value) {
        return Math.max(0, Math.min(100, Number(value)));
      },
      async load(scopeId, userId) {
        calls.load.push({ scopeId, userId });
        return {
          affinity: 40,
          longTermAffinity: 40,
          nickname: "小明",
          specialRelation: "朋友",
        };
      },
    },
    blacklist: {
      async removeTemporary(platform, userId) {
        calls.removeTemporary.push({ platform, userId });
        return true;
      },
      async recordPermanent(platform, userId, detail) {
        calls.recordPermanent.push({ platform, userId, detail });
        return { ok: true };
      },
      async recordTemporary(platform, userId, durationHours, penalty, detail) {
        calls.recordTemporary.push({
          platform,
          userId,
          durationHours,
          penalty,
          detail,
        });
        return { ok: true };
      },
    },
    unblockPermanent: async (params) => {
      calls.unblockPermanent.push(params);
      return { removed: true, affinityReset: true, affinity: 10 };
    },
    userAlias: {
      async setAlias(platform, userId, alias) {
        calls.setAlias.push({ platform, userId, alias });
        return { ok: true };
      },
    },
    shortTermConfig: {
      promoteThreshold: 10,
      demoteThreshold: -10,
      longTermPromoteStep: 1,
      longTermDemoteStep: 1,
    },
    actionWindowConfig: {
      maxEntries: 20,
    },
    coefficientConfig: {
      base: 1,
      maxDrop: 0.3,
      maxBoost: 0.5,
      decayPerDay: 0.03,
      boostPerDay: 0.03,
      min: 0.7,
      max: 1.5,
    },
    log: () => {},
    ...overrides,
  };

  return { deps, calls };
}

test("registerNativeTools 默认不注册任何工具", () => {
  const { deps, calls } = createDeps();

  registerNativeTools(deps);

  assert.deepEqual(calls.tools, []);
});

test("registerNativeTools 按复选框列表和工具配置注册工具", () => {
  const { deps, calls } = createDeps({
    config: createConfig({
      nativeToolSettings: {
        ...createConfig().nativeToolSettings,
        enabledNativeTools: ["affinity", "relationship"],
        affinity: {
          toolName: "custom_affinity",
          description: "custom affinity description",
        },
        relationship: {
          toolName: "custom_relationship",
          description: "custom relationship description",
        },
      },
    }),
  });

  registerNativeTools(deps);

  assert.deepEqual(
    calls.tools.map((item) => item.name),
    ["custom_affinity", "custom_relationship"],
  );
  assert.equal(calls.tools[0].tool.description, "custom affinity description");
  assert.equal(
    calls.tools[0].tool.meta.defaultAvailability.characterScope,
    "all",
  );
});

test("原生工具 schema 不暴露 scopeId，执行时使用当前配置和会话 platform", async () => {
  const { deps, calls } = createDeps({
    config: createConfig({
      nativeToolSettings: {
        ...createConfig().nativeToolSettings,
        enabledNativeTools: ["relationship"],
      },
    }),
  });
  registerNativeTools(deps);
  const tool = calls.tools[0].tool.createTool();

  assert.equal(tool.schema.shape.scopeId, undefined);
  const result = await tool._call(
    { userId: "1001", action: "set", relation: "朋友" },
    undefined,
    { configurable: { session: { platform: "onebot-v12" } } },
  );

  assert.equal(result, "已将 1001 的关系设置为 朋友");
  assert.deepEqual(calls.save, [
    {
      seed: { scopeId: "宁宁", platform: "onebot-v12", userId: "1001" },
      value: Number.NaN,
      relation: "朋友",
    },
  ]);
});

test("黑名单原生工具解除永久黑名单时标记 native 来源", async () => {
  const { deps, calls } = createDeps({
    config: createConfig({
      nativeToolSettings: {
        ...createConfig().nativeToolSettings,
        enabledNativeTools: ["blacklist"],
      },
    }),
  });
  registerNativeTools(deps);
  const tool = calls.tools[0].tool.createTool();

  const result = await tool._call(
    { userId: "1001", action: "remove", mode: "permanent" },
    undefined,
    { configurable: { session: { platform: "onebot" } } },
  );

  assert.equal(result, "已解除 1001 的永久黑名单");
  assert.equal(calls.unblockPermanent[0].source, "native");
  assert.equal(calls.unblockPermanent[0].seed.scopeId, "宁宁");
});
