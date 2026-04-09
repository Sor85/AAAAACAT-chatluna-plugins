/**
 * 思考存储单元测试
 * 覆盖 key 构建与当前/上次思考缓存行为
 */

import { describe, expect, it } from "vitest";
import { buildThoughtStoreKey, createThinkStore } from "../../src/store/think-store";

describe("buildThoughtStoreKey", () => {
  it("按平台/群/用户生成 key", () => {
    const key = buildThoughtStoreKey({
      platform: "onebot",
      guildId: "10001",
      userId: "20002",
    });

    expect(key).toBe("onebot:10001:20002");
  });

  it("私聊缺失 guildId 时使用 private", () => {
    const key = buildThoughtStoreKey({
      platform: "onebot",
      guildId: undefined,
      userId: "20002",
    });

    expect(key).toBe("onebot:private:20002");
  });

  it("缺失 platform 或 userId 时返回 null", () => {
    expect(
      buildThoughtStoreKey({
        platform: "",
        guildId: "10001",
        userId: "20002",
      }),
    ).toBeNull();

    expect(
      buildThoughtStoreKey({
        platform: "onebot",
        guildId: "10001",
        userId: "",
      }),
    ).toBeNull();
  });
});

describe("createThinkStore", () => {
  it("首次写入只保存 current", () => {
    const store = createThinkStore();
    store.update("k", "A");

    expect(store.getCurrent("k")).toBe("A");
    expect(store.getPrevious("k")).toBeUndefined();
  });

  it("第二次写入会把旧 current 推到 previous", () => {
    const store = createThinkStore();
    store.update("k", "A");
    store.update("k", "B");

    expect(store.getCurrent("k")).toBe("B");
    expect(store.getPrevious("k")).toBe("A");
  });

  it("第三次写入会继续滚动 previous", () => {
    const store = createThinkStore();
    store.update("k", "A");
    store.update("k", "B");
    store.update("k", "C");

    expect(store.getCurrent("k")).toBe("C");
    expect(store.getPrevious("k")).toBe("B");
    expect(store.size()).toBe(1);
  });
});
