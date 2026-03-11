/**
 * 模型响应日志拦截测试
 * 验证日志提取与 legacy logger hook 的基础行为
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractModelResponseText,
  hookCharacterModelResponseLogger,
} = require("../lib/index.js");

test("extractModelResponseText 提取单字符串日志中的响应内容", () => {
  const response = extractModelResponseText([
    'model response: <affinity scopeId="宁宁" userId="1" delta="5" action="increase" />',
  ]);

  assert.equal(
    response,
    '<affinity scopeId="宁宁" userId="1" delta="5" action="increase" />',
  );
});

test("extractModelResponseText 支持分参数日志格式", () => {
  const response = extractModelResponseText([
    "model response:",
    '<relationship scopeId="宁宁" userId="1" action="set" relation="哥哥" />',
  ]);

  assert.equal(
    response,
    '<relationship scopeId="宁宁" userId="1" action="set" relation="哥哥" />',
  );
});

test("extractModelResponseText 忽略非目标日志", () => {
  const response = extractModelResponseText([
    'agent intermediate response: <affinity scopeId="宁宁" userId="1" delta="5" action="increase" />',
  ]);

  assert.equal(response, null);
});

test("hookCharacterModelResponseLogger 命中模型响应时转发到处理器", async () => {
  const debugCalls = [];
  const seen = [];
  const logger = {
    debug(...args) {
      debugCalls.push(args);
    },
  };

  const unhook = hookCharacterModelResponseLogger({
    logger,
    async processModelResponse(response) {
      seen.push(response);
    },
  });

  logger.debug(
    'model response: <affinity scopeId="宁宁" userId="1" delta="5" action="increase" />',
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(debugCalls.length, 1);
  assert.equal(seen.length, 1);
  assert.equal(
    seen[0],
    '<affinity scopeId="宁宁" userId="1" delta="5" action="increase" />',
  );

  unhook();
});

test("hookCharacterModelResponseLogger unhook 后恢复原始 debug", async () => {
  const calls = [];
  const logger = {
    debug(...args) {
      calls.push(args);
    },
  };
  let processed = 0;

  const unhook = hookCharacterModelResponseLogger({
    logger,
    async processModelResponse() {
      processed += 1;
    },
  });

  unhook();
  logger.debug(
    'model response: <affinity scopeId="宁宁" userId="1" delta="5" action="increase" />',
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.length, 1);
  assert.equal(processed, 0);
});
