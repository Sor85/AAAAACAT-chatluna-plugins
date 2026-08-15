import assert from "node:assert/strict";
import test from "node:test";
import { createInspectRenderer } from "../../src/renders/inspect";

const inspectData = {
  userId: "123456789",
  nickname: "测试用户",
  platform: "",
  relation: "挚友",
  compositeAffinity: 100,
  longTermAffinity: 100,
  shortTermAffinity: 20,
  coefficient: 1,
  streak: 3,
  chatCount: 99,
  lastInteraction: "2026-08-15 12:00:00",
};

function readPngHeight(buffer: Buffer): number {
  return buffer.readUInt32BE(20);
}

test("详情图片高度应随印象内容增长，避免底部被裁切", async () => {
  const renderInspect = createInspectRenderer();
  const shortImage = await renderInspect({
    ...inspectData,
    impression: "简短印象",
  });
  const longImage = await renderInspect({
    ...inspectData,
    impression: "这是一段用于复现详情卡片内容被截断问题的很长印象。".repeat(80),
  });

  assert.ok(shortImage);
  assert.ok(longImage);
  assert.ok(
    readPngHeight(longImage) > readPngHeight(shortImage),
    "长印象应扩展图片高度，而不是被固定画布裁切",
  );
});
