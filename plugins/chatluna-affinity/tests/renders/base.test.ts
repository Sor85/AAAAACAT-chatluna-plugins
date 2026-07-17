import assert from "node:assert/strict";
import test from "node:test";
import { renderHtml } from "../../src/renders/base";

test("renderHtml 使用 Takumi 渲染中文 PNG", async () => {
  const buffer = await renderHtml(
    `<!doctype html><html><head><style>body{margin:0}.card{width:320px;padding:24px;background:#fff;font-family:"Noto Sans SC",sans-serif;font-size:20px}</style></head><body><div class="card">好感度排行</div></body></html>`,
    { width: 320, deviceScaleFactor: 2 },
  );

  assert.ok(buffer);
  assert.equal(buffer.subarray(1, 4).toString(), "PNG");
  assert.equal(buffer.readUInt32BE(16), 640);
  assert.ok(buffer.readUInt32BE(20) >= 136);
});

test("renderHtml 应加载中文字体而不是统一渲染为方框", async () => {
  const renderText = (text: string) =>
    renderHtml(
      `<!doctype html><html><head><style>body{margin:0}.text{width:320px;padding:24px;background:#fff;font-family:"Noto Sans SC",sans-serif;font-size:20px}</style></head><body><div class="text">${text}</div></body></html>`,
      { width: 320, deviceScaleFactor: 1 },
    );

  const [first, second] = await Promise.all([
    renderText("好感度排行"),
    renderText("测试用户名"),
  ]);

  assert.ok(first);
  assert.ok(second);
  assert.notDeepEqual(first, second);
});

test("renderHtml 应加载韩文字体而不是统一渲染为方框", async () => {
  const renderText = (text: string) =>
    renderHtml(
      `<!doctype html><html><head><style>body{margin:0}.text{width:320px;padding:24px;background:#fff;font-family:"Noto Sans SC",sans-serif;font-size:20px}</style></head><body><div class="text">${text}</div></body></html>`,
      { width: 320, deviceScaleFactor: 1 },
    );

  const [first, second] = await Promise.all([
    renderText("한국어"),
    renderText("테스트"),
  ]);

  assert.ok(first);
  assert.ok(second);
  assert.notDeepEqual(first, second);
});

test("renderHtml 应渲染生僻字匊而不是缺字方框", async () => {
  const renderText = (text: string) =>
    renderHtml(
      `<!doctype html><html><head><style>body{margin:0}.text{width:96px;height:96px;padding:16px;background:#fff;font-family:"Noto Sans SC",sans-serif;font-size:48px}</style></head><body><div class="text">${text}</div></body></html>`,
      { width: 96, height: 96, deviceScaleFactor: 1 },
    );

  const [rareCharacter, missingGlyph] = await Promise.all([
    renderText("匊"),
    renderText("\uE000"),
  ]);

  assert.ok(rareCharacter);
  assert.ok(missingGlyph);
  assert.notDeepEqual(rareCharacter, missingGlyph);
});
