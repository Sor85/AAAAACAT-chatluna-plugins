import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortChartTooltipPayload } from "../../client/components/ui/chart";

describe("chart tooltip", () => {
  it("sorts payload by current value descending", () => {
    const payload = [
      { dataKey: "affinity", value: 101 },
      { dataKey: "longTermAffinity", value: 92 },
      { dataKey: "chatCount", value: 323 },
    ];

    assert.deepEqual(
      sortChartTooltipPayload(payload).map((item) => item.dataKey),
      ["chatCount", "affinity", "longTermAffinity"],
    );
  });

  it("keeps original order when values are equal", () => {
    const payload = [
      { dataKey: "affinity", value: 100 },
      { dataKey: "longTermAffinity", value: "100" },
      { dataKey: "chatCount", value: 10 },
    ];

    assert.deepEqual(
      sortChartTooltipPayload(payload).map((item) => item.dataKey),
      ["affinity", "longTermAffinity", "chatCount"],
    );
  });
});
