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
      { relation: "朋友", count: 1 },
      { relation: "重点观察", count: 1 },
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
    assert.equal(data.topUsers[1].avatarUrl, null);
    assert.equal(data.topUsers[1].name, "user-b");
    assert.equal(data.topUsers[1].relationTone, "custom");
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
