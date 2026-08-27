import assert from "node:assert/strict";
import test from "node:test";
import { createRankListRenderer } from "../../src/renders/rank-list";

function readPngHeight(buffer: Buffer): number {
  return buffer.readUInt32BE(20);
}

test("排行榜图片高度应贴合实际内容，避免底部出现空白画布", async () => {
  const renderRankList = createRankListRenderer();
  const image = await renderRankList(
    "好感度排行",
    Array.from({ length: 10 }, (_, index) => ({
      rank: index + 1,
      name: `测试用户 ${index + 1}`,
      relation: "友好",
      affinity: 100 - index,
    })),
  );

  assert.ok(image);
  assert.ok(
    readPngHeight(image) < 2600,
    "10 条排行不应使用 1300px 的固定逻辑画布（2 倍缩放后为 2600px）",
  );
});
