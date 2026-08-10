/**
 * 活跃作用域协调器测试
 * 覆盖唯一作用域、重复作用域、多作用域与释放后的持有权迁移
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { registerActiveScope } = require("../../lib/index.js");

function createContext() {
  return { root: {} };
}

test("单个作用域实例成为唯一持有者", () => {
  const ctx = createContext();
  const states = [];
  const dispose = registerActiveScope(ctx, "nene", (state) => states.push(state));

  assert.deepEqual(states, [{ isOnlyScope: true, isOwner: true }]);
  dispose();
});

test("重复相同 scopeId 只允许第一个实例持有注册权", () => {
  const ctx = createContext();
  const firstStates = [];
  const secondStates = [];
  const disposeFirst = registerActiveScope(ctx, "nene", (state) =>
    firstStates.push(state),
  );
  const disposeSecond = registerActiveScope(ctx, "nene", (state) =>
    secondStates.push(state),
  );

  assert.deepEqual(firstStates.at(-1), {
    isOnlyScope: true,
    isOwner: true,
  });
  assert.deepEqual(secondStates.at(-1), {
    isOnlyScope: true,
    isOwner: false,
  });

  disposeFirst();
  assert.deepEqual(secondStates.at(-1), {
    isOnlyScope: true,
    isOwner: true,
  });
  disposeSecond();
});

test("出现不同 scopeId 时撤销唯一状态，释放后恢复", () => {
  const ctx = createContext();
  const firstStates = [];
  const secondStates = [];
  const disposeFirst = registerActiveScope(ctx, "nene", (state) =>
    firstStates.push(state),
  );
  const disposeSecond = registerActiveScope(ctx, "saki", (state) =>
    secondStates.push(state),
  );

  assert.deepEqual(firstStates.at(-1), {
    isOnlyScope: false,
    isOwner: false,
  });
  assert.deepEqual(secondStates.at(-1), {
    isOnlyScope: false,
    isOwner: false,
  });

  disposeSecond();
  assert.deepEqual(firstStates.at(-1), {
    isOnlyScope: true,
    isOwner: true,
  });
  disposeFirst();
});
