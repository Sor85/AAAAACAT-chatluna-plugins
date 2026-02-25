/**
 * 随机命令核心逻辑测试
 * 覆盖空模板与随机键选择的关键边界
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createShuffledKeys,
  getRandomCandidatesWithDedupe,
  pickRandomItem,
  recordRandomSelection,
} from "../../src/command/random";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createShuffledKeys", () => {
  it("空输入返回空数组", () => {
    expect(createShuffledKeys([])).toEqual([]);
  });

  it("会过滤空白并按随机种子打乱", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.5);

    const result = createShuffledKeys([" a ", "", "b", " c "]);

    expect(result).toEqual(["b", "c", "a"]);
    randomSpy.mockRestore();
  });
});

describe("pickRandomItem", () => {
  it("空数组返回 undefined", () => {
    expect(pickRandomItem([])).toBeUndefined();
  });

  it("按随机索引返回元素", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.49);
    expect(pickRandomItem(["a", "b"])).toBe("a");

    vi.spyOn(Math, "random").mockReturnValueOnce(0.99);
    expect(pickRandomItem(["a", "b"])).toBe("b");
  });
});

describe("getRandomCandidatesWithDedupe", () => {
  it("去重关闭时返回原候选", () => {
    const result = getRandomCandidatesWithDedupe(
      [{ key: "a" }, { key: "b" }],
      new Map<string, number>([["a", 1]]),
      { enabled: false, windowHours: 24, nowMs: 1000 },
    );

    expect(result.candidates.map((item) => item.key)).toEqual(["a", "b"]);
  });

  it("去重开启时过滤窗口内已命中 key", () => {
    const nowMs = 2 * 60 * 60 * 1000;
    const result = getRandomCandidatesWithDedupe(
      [{ key: "a" }, { key: "b" }],
      new Map<string, number>([["a", nowMs - 60 * 60 * 1000]]),
      { enabled: true, windowHours: 24, nowMs },
    );

    expect(result.candidates.map((item) => item.key)).toEqual(["b"]);
  });

  it("去重开启时会清理超窗历史记录", () => {
    const nowMs = 25 * 60 * 60 * 1000;
    const result = getRandomCandidatesWithDedupe(
      [{ key: "a" }],
      new Map<string, number>([["a", 0]]),
      { enabled: true, windowHours: 24, nowMs },
    );

    expect(result.history.has("a")).toBe(false);
    expect(result.candidates.map((item) => item.key)).toEqual(["a"]);
  });
});

describe("recordRandomSelection", () => {
  it("去重开启时记录命中时间", () => {
    const result = recordRandomSelection(new Map(), "a", {
      enabled: true,
      windowHours: 24,
      nowMs: 123,
    });

    expect(result.get("a")).toBe(123);
  });

  it("去重关闭时不新增记录", () => {
    const result = recordRandomSelection(new Map(), "a", {
      enabled: false,
      windowHours: 24,
      nowMs: 123,
    });

    expect(result.has("a")).toBe(false);
  });
});
