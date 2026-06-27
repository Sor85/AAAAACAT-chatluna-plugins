import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRelationListMinHeight } from "../../client/dashboard/relation-layout";

describe("relation list layout", () => {
  it("uses the taller relation tab as the shared list height", () => {
    assert.equal(getRelationListMinHeight(5), 228);
    assert.equal(getRelationListMinHeight(0), 0);
    assert.equal(getRelationListMinHeight(20), 372);
  });
});
