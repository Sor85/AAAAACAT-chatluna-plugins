import { describe, expect, it } from "vitest";
import { renderTakumiHtml } from "../../src/render/takumi";

describe("Takumi renderer", () => {
  it("应加载中文字体而不是统一渲染为方框", async () => {
    const renderText = (text: string) =>
      renderTakumiHtml(
        `<!doctype html><html><head><style>body{margin:0}.text{width:320px;padding:24px;background:#fff;font-family:"Noto Sans SC",sans-serif;font-size:20px}</style></head><body><div class="text">${text}</div></body></html>`,
        320,
      );

    const [first, second] = await Promise.all([
      renderText("无需参数"),
      renderText("测试表情"),
    ]);

    expect(first).not.toEqual(second);
  });

  it("应加载韩文字体而不是统一渲染为方框", async () => {
    const renderText = (text: string) =>
      renderTakumiHtml(
        `<!doctype html><html><head><style>body{margin:0}.text{width:320px;padding:24px;background:#fff;font-family:"Noto Sans SC",sans-serif;font-size:20px}</style></head><body><div class="text">${text}</div></body></html>`,
        320,
      );

    const [first, second] = await Promise.all([
      renderText("한국어"),
      renderText("테스트"),
    ]);

    expect(first).not.toEqual(second);
  });
});
