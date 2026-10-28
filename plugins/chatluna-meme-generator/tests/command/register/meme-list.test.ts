/**
 * meme.list 图片模式单元测试
 * 覆盖高密度出图与长列表分页
 */

import { describe, expect, it, vi } from "vitest";
import type { Context } from "koishi";

vi.mock("koishi", () => ({
  h: {
    image: (buffer: Buffer, mimeType: string) => ({ buffer, mimeType }),
  },
}));

import {
  MEME_LIST_IMAGE_DEVICE_SCALE_FACTOR,
  MEME_LIST_IMAGE_LAYOUT_WIDTH,
  MEME_LIST_IMAGE_PAGE_MAX_HEIGHT,
  buildListMessage,
  buildMemeListImageHtml,
  paginateMemeListImageSections,
  resolveMemeListImageColumns,
  type MemeListImageBlock,
} from "../../../src/command/register/meme-list";
import type { MemeListSection } from "../../../src/command/register/types";
import { measureTakumiHtml } from "../../../src/render/takumi";

const logger = { warn: () => undefined } as unknown as ReturnType<
  Context["logger"]
>;

function createSections(total: number): MemeListSection[] {
  const aliases = Array.from({ length: total }, (_, index) => `模板${index}`);
  const half = Math.ceil(aliases.length / 2);

  return [
    { title: "图片+文字", aliases: aliases.slice(0, half) },
    { title: "纯文字", aliases: aliases.slice(half) },
  ];
}

function flattenAliases(pages: MemeListImageBlock[][]): string[] {
  return pages.flatMap((page) => page.flatMap((block) => block.aliases));
}

function decodePngSize(segment: string): { width: number; height: number } {
  const base64 = segment.replace(/^<img src="data:image\/png;base64,/, "").replace(/"\/>$/, "");
  const buffer = Buffer.from(base64, "base64");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe("meme.list 图片渲染", () => {
  it("列数应按布局宽度均分", () => {
    expect(resolveMemeListImageColumns()).toBeGreaterThanOrEqual(2);
    expect(Number.isInteger(resolveMemeListImageColumns())).toBe(true);
  });

  it("应按页高上限分页且别名不丢不重", async () => {
    const sections = createSections(240);
    const pages = await paginateMemeListImageSections(sections);

    expect(pages.length).toBeGreaterThan(1);
    expect(flattenAliases(pages)).toEqual(
      sections.flatMap((section) => section.aliases),
    );

    for (const page of pages) {
      const height = await measureTakumiHtml(
        buildMemeListImageHtml(page),
        MEME_LIST_IMAGE_LAYOUT_WIDTH,
      );
      expect(height).toBeLessThanOrEqual(MEME_LIST_IMAGE_PAGE_MAX_HEIGHT);
    }
  });

  it("分类跨页时标题应带续页标记", async () => {
    const pages = await paginateMemeListImageSections(createSections(240));
    const titles = pages.flatMap((page) => page.map((block) => block.title));

    expect(titles.some((title) => title.endsWith("（续）"))).toBe(true);
  });

  it("应按设备像素比出图，单页宽度等于布局宽度乘以倍率", async () => {
    const message = await buildListMessage(
      createSections(20),
      ["图片+文字", "模板0 模板1"],
      true,
      logger,
    );

    const segments = message.split("</img>").filter(Boolean);
    expect(message.startsWith('<img src="data:image/png;base64,')).toBe(true);

    const first = message.slice(0, message.indexOf("/>") + 2);
    const { width } = decodePngSize(first);
    expect(width).toBe(
      MEME_LIST_IMAGE_LAYOUT_WIDTH * MEME_LIST_IMAGE_DEVICE_SCALE_FACTOR,
    );
    expect(segments.length).toBeGreaterThanOrEqual(1);
  });

  it("长列表应输出多张图片", async () => {
    const sections = createSections(240);
    const message = await buildListMessage(sections, [], true, logger);
    const imageCount = message.split("<img ").length - 1;

    expect(imageCount).toBeGreaterThan(1);
  });

  it("关闭图片渲染时返回纯文本", async () => {
    const message = await buildListMessage(
      createSections(2),
      ["图片+文字", "模板0 模板1"],
      false,
      logger,
    );

    expect(message).toBe("图片+文字\n模板0 模板1");
  });
});
