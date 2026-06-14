import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DASHBOARD_EVENT,
  getDashboardData,
  registerDashboardWebui,
} from "../../../src/services/dashboard";
import {
  BLACKLIST_MODEL_NAME_V2,
  MODEL_NAME_V2,
  USER_ALIAS_MODEL_NAME_V2,
} from "../../../src/models";
import type { AffinityRecord, BlacklistRecord } from "../../../src/types";

const config = {
  scopeId: "test-scope",
};

function createContext(tables: Record<string, unknown[]>) {
  return {
    database: {
      async get(model: string, query: Record<string, unknown>) {
        const rows = tables[model] || [];
        return rows.filter((row) =>
          Object.entries(query).every(
            ([key, value]) => (row as Record<string, unknown>)[key] === value,
          ),
        );
      },
    },
  } as never;
}

describe("dashboard data", () => {
  it("returns zeroed summary for empty scope", async () => {
    const data = await getDashboardData(createContext({}), config);

    assert.equal(data.scopeId, "test-scope");
    assert.equal(data.totals.users, 0);
    assert.equal(data.totals.blacklisted, 0);
    assert.equal(data.totals.aliases, 0);
    assert.equal(data.averages.affinity, 0);
    assert.deepEqual(data.relationStats, []);
    assert.deepEqual(data.blacklistItems, []);
    assert.deepEqual(data.topUsers, []);
    assert.equal(data.trends.week.length, 7);
    assert.equal(data.trends.month.length, 30);
    assert.deepEqual(data.trends.all, []);
    assert.deepEqual(data.weeklyChanges.users, {
      current: 0,
      previous: 0,
      percent: 0,
    });
  });

  it("returns full sorted ranking for frontend pagination", async () => {
    const affinityRows: AffinityRecord[] = Array.from(
      { length: 12 },
      (_, index) => ({
        scopeId: "test-scope",
        userId: `user-${String(index + 1).padStart(2, "0")}`,
        nickname: null,
        affinity: index + 1,
        relation: "陌生",
        specialRelation: null,
        longTermAffinity: index + 1,
        shortTermAffinity: 0,
        chatCount: index + 1,
        actionStats: null,
        lastInteractionAt: null,
        coefficientState: null,
      }),
    );
    const data = await getDashboardData(
      createContext({
        [MODEL_NAME_V2]: affinityRows,
      }),
      config,
    );

    assert.equal(data.topUsers.length, 12);
    assert.deepEqual(
      data.topUsers.slice(0, 3).map((user) => user.userId),
      ["user-12", "user-11", "user-10"],
    );
    assert.deepEqual(
      data.topUsers.slice(-2).map((user) => user.userId),
      ["user-02", "user-01"],
    );
  });

  it("aggregates current scope rows only", async () => {
    const affinityRows: AffinityRecord[] = [
      {
        scopeId: "test-scope",
        userId: "10001",
        nickname: "Alice",
        affinity: 80,
        relation: "朋友",
        specialRelation: null,
        longTermAffinity: 70,
        shortTermAffinity: 10,
        chatCount: 5,
        actionStats: null,
        lastInteractionAt: new Date("2026-06-01T12:00:00.000Z"),
        coefficientState: null,
      },
      {
        scopeId: "test-scope",
        userId: "user-b",
        nickname: null,
        affinity: 40,
        relation: "陌生",
        specialRelation: "重点观察",
        longTermAffinity: 45,
        shortTermAffinity: -5,
        chatCount: 3,
        actionStats: null,
        lastInteractionAt: new Date("2026-06-02T12:00:00.000Z"),
        coefficientState: null,
      },
      {
        scopeId: "other-scope",
        userId: "user-c",
        nickname: null,
        affinity: 100,
        relation: "朋友",
        specialRelation: null,
        longTermAffinity: 100,
        shortTermAffinity: 0,
        chatCount: 99,
        actionStats: null,
        lastInteractionAt: new Date("2026-06-03T12:00:00.000Z"),
        coefficientState: null,
      },
    ];
    const blacklistRows: BlacklistRecord[] = [
      {
        scopeId: "test-scope",
        platform: "onebot",
        userId: "10001",
        mode: "permanent",
        blockedAt: new Date("2026-06-04T12:00:00.000Z"),
        expiresAt: null,
        nickname: "Blocked Alice",
        note: "bad actor",
        durationHours: null,
        penalty: null,
      },
      {
        scopeId: "test-scope",
        platform: "onebot",
        userId: "user-b",
        mode: "temporary",
        blockedAt: new Date("2026-06-05T12:00:00.000Z"),
        expiresAt: new Date("2026-06-10T00:00:00.000Z"),
        nickname: null,
        note: null,
        durationHours: 24,
        penalty: 5,
      },
    ];
    const data = await getDashboardData(
      createContext({
        [MODEL_NAME_V2]: affinityRows,
        [BLACKLIST_MODEL_NAME_V2]: blacklistRows,
        [USER_ALIAS_MODEL_NAME_V2]: [
          {
            scopeId: "test-scope",
            platform: "onebot",
            userId: "user-a",
            alias: "A",
            updatedAt: new Date(),
          },
        ],
      }),
      {
        ...config,
        relationshipAffinityLevels: [
          { min: 0, max: 10, relation: "陌生" },
          { min: 11, max: 50, relation: "朋友" },
          { min: 51, max: 100, relation: "亲密" },
        ],
      },
    );

    assert.equal(data.totals.users, 2);
    assert.equal(data.totals.blacklisted, 2);
    assert.equal(data.totals.permanentBlacklisted, 1);
    assert.equal(data.totals.temporaryBlacklisted, 1);
    assert.equal(data.totals.aliases, 1);
    assert.equal(data.totals.chatCount, 8);
    assert.equal(data.averages.affinity, 60);
    assert.equal(data.averages.longTermAffinity, 57.5);
    assert.equal(data.averages.shortTermAffinity, 2.5);
    assert.equal(data.latestInteractionAt, "2026-06-02T12:00:00.000Z");
    assert.deepEqual(data.relationStats, [
      { relation: "朋友", count: 1, kind: "preset" },
      { relation: "重点观察", count: 1, kind: "custom" },
    ]);
    assert.deepEqual(data.blacklistItems, [
      {
        platform: "onebot",
        userId: "user-b",
        name: "user-b",
        affinity: 40,
        mode: "temporary",
        blockedAt: "2026-06-05T12:00:00.000Z",
        expiresAt: "2026-06-10T00:00:00.000Z",
        note: "",
      },
      {
        platform: "onebot",
        userId: "10001",
        name: "Blocked Alice",
        affinity: 80,
        mode: "permanent",
        blockedAt: "2026-06-04T12:00:00.000Z",
        expiresAt: null,
        note: "bad actor",
      },
    ]);
    assert.deepEqual(
      data.topUsers.map((user) => user.userId),
      ["10001", "user-b"],
    );
    assert.equal(
      data.topUsers[0].avatarUrl,
      "https://q1.qlogo.cn/g?b=qq&nk=10001&s=640",
    );
    assert.equal(data.topUsers[0].relationTone, "medium");
    assert.deepEqual(data.topUsers[0].historyPoints, [
      {
        label: "当前",
        timestamp: "2026-06-01T12:00:00.000Z",
        affinity: 80,
      },
    ]);
    assert.equal(data.topUsers[1].avatarUrl, null);
    assert.equal(data.topUsers[1].name, "user-b");
    assert.equal(data.topUsers[1].relationTone, "custom");
  });

  it("builds trend series and weekly comparisons from current scope rows", async () => {
    const affinityRows: AffinityRecord[] = [
      {
        scopeId: "test-scope",
        userId: "current-a",
        nickname: "Current A",
        affinity: 70,
        relation: "朋友",
        specialRelation: null,
        longTermAffinity: 68,
        shortTermAffinity: 2,
        chatCount: 10,
        actionStats: JSON.stringify({
          total: 2,
          counts: { increase: 1, decrease: 1 },
          entries: [
            { action: "increase", timestamp: Date.parse("2026-06-12T12:00:00.000Z") },
            { action: "decrease", timestamp: Date.parse("2026-06-13T12:00:00.000Z") },
          ],
        }),
        lastInteractionAt: new Date("2026-06-13T12:00:00.000Z"),
        coefficientState: null,
      },
      {
        scopeId: "test-scope",
        userId: "current-b",
        nickname: null,
        affinity: 30,
        relation: "陌生",
        specialRelation: null,
        longTermAffinity: 30,
        shortTermAffinity: 0,
        chatCount: 4,
        actionStats: null,
        lastInteractionAt: new Date("2026-06-10T12:00:00.000Z"),
        coefficientState: null,
      },
      {
        scopeId: "test-scope",
        userId: "previous-a",
        nickname: null,
        affinity: 50,
        relation: "朋友",
        specialRelation: null,
        longTermAffinity: 50,
        shortTermAffinity: 0,
        chatCount: 6,
        actionStats: null,
        lastInteractionAt: new Date("2026-06-03T12:00:00.000Z"),
        coefficientState: null,
      },
      {
        scopeId: "other-scope",
        userId: "other",
        nickname: null,
        affinity: 100,
        relation: "亲密",
        specialRelation: null,
        longTermAffinity: 100,
        shortTermAffinity: 0,
        chatCount: 99,
        actionStats: null,
        lastInteractionAt: new Date("2026-06-13T12:00:00.000Z"),
        coefficientState: null,
      },
    ];
    const data = await getDashboardData(
      createContext({
        [MODEL_NAME_V2]: affinityRows,
        [BLACKLIST_MODEL_NAME_V2]: [
          {
            scopeId: "test-scope",
            platform: "onebot",
            userId: "blocked-current",
            mode: "temporary",
            blockedAt: new Date("2026-06-11T12:00:00.000Z"),
            expiresAt: null,
            nickname: null,
            note: null,
            durationHours: 24,
            penalty: 5,
          },
          {
            scopeId: "test-scope",
            platform: "onebot",
            userId: "blocked-previous",
            mode: "permanent",
            blockedAt: new Date("2026-06-02T12:00:00.000Z"),
            expiresAt: null,
            nickname: null,
            note: null,
            durationHours: null,
            penalty: null,
          },
        ],
        [USER_ALIAS_MODEL_NAME_V2]: [
          {
            scopeId: "test-scope",
            platform: "onebot",
            userId: "current-a",
            alias: "A",
            updatedAt: new Date("2026-06-12T12:00:00.000Z"),
          },
          {
            scopeId: "test-scope",
            platform: "onebot",
            userId: "previous-a",
            alias: "P",
            updatedAt: new Date("2026-06-03T12:00:00.000Z"),
          },
        ],
      }),
      {
        ...config,
        now: new Date("2026-07-14T12:00:00.000Z"),
      },
    );

    assert.deepEqual(data.weeklyChanges.users, {
      current: 2,
      previous: 1,
      percent: 100,
    });
    assert.deepEqual(data.weeklyChanges.averageAffinity, {
      current: 50,
      previous: 50,
      percent: 0,
    });
    assert.deepEqual(data.weeklyChanges.chatCount, {
      current: 14,
      previous: 6,
      percent: 133.33,
    });
    assert.deepEqual(data.weeklyChanges.aliases, {
      current: 1,
      previous: 1,
      percent: 0,
    });

    const currentDay = data.trends.week.find((point) => point.label === "6/13");
    assert.deepEqual(currentDay, {
      label: "6/13",
      users: 1,
      averageAffinity: 70,
      chatCount: 10,
      blacklisted: 0,
    });
    const blacklistDay = data.trends.week.find((point) => point.label === "6/11");
    assert.deepEqual(blacklistDay, {
      label: "6/11",
      users: 0,
      averageAffinity: 0,
      chatCount: 0,
      blacklisted: 1,
    });
    assert.deepEqual(data.topUsers[0].historyPoints, [
      {
        label: "6/12",
        timestamp: "2026-06-12T12:00:00.000Z",
        affinity: 70,
      },
      {
        label: "6/13",
        timestamp: "2026-06-13T12:00:00.000Z",
        affinity: 70,
      },
    ]);
  });

  it("ignores alias updates when anchoring trend dates", async () => {
    const data = await getDashboardData(
      createContext({
        [MODEL_NAME_V2]: [
          {
            scopeId: "test-scope",
            userId: "current-a",
            nickname: null,
            affinity: 20,
            relation: "陌生",
            specialRelation: null,
            longTermAffinity: 20,
            shortTermAffinity: 0,
            chatCount: 1,
            actionStats: null,
            lastInteractionAt: new Date("2026-06-05T12:00:00.000Z"),
            coefficientState: null,
          },
        ],
        [USER_ALIAS_MODEL_NAME_V2]: [
          {
            scopeId: "test-scope",
            platform: "onebot",
            userId: "current-a",
            alias: "A",
            updatedAt: new Date("2026-07-14T12:00:00.000Z"),
          },
        ],
      }),
      {
        ...config,
        now: new Date("2026-07-14T12:00:00.000Z"),
      },
    );

    const latestTrendDay = data.trends.week.at(-1);
    assert.equal(latestTrendDay?.label, "6/5");
  });
});

describe("dashboard webui", () => {
  it("registers console entry and dashboard listener by default", () => {
    const calls: {
      entry?: unknown;
      listener?: {
        event: string;
        options?: { authority?: number };
      };
    } = {};
    const entry = { dev: "/dev/client.ts", prod: "/dist" };
    const ctx = {
      inject(services: string[], callback: (innerCtx: unknown) => void) {
        assert.deepEqual(services, ["console"]);
        callback({
          console: {
            addEntry(nextEntry: unknown) {
              calls.entry = nextEntry;
            },
            addListener(
              event: string,
              _callback: unknown,
              options?: { authority?: number },
            ) {
              calls.listener = { event, options };
            },
          },
        });
      },
    };

    registerDashboardWebui({
      ctx: ctx as never,
      config: { scopeId: "test-scope" },
      entry,
      log() {},
    });

    assert.deepEqual(calls.entry, entry);
    assert.deepEqual(calls.listener, {
      event: DASHBOARD_EVENT,
      options: { authority: 1 },
    });
  });

  it("does not register console assets when dashboard is disabled", () => {
    let injected = false;

    registerDashboardWebui({
      ctx: {
        inject() {
          injected = true;
        },
      } as never,
      config: { enableDashboard: false, scopeId: "test-scope" },
      entry: { dev: "/dev/client.ts", prod: "/dist" },
      log() {},
    });

    assert.equal(injected, false);
  });
});
