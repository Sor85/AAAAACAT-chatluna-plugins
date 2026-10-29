/**
 * meme.list 图片模式单元测试
 * 覆盖高密度出图、单张/多张出图模式与长列表分页
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
  buildListImages,
  formatMemeListImageMessage,
  buildMemeListImageHtml,
  paginateMemeListImageSections,
  resolveMemeListImageColumns,
  type MemeListImageBlock,
} from "../../../src/command/register/meme-list";
import type { MemeListSection } from "../../../src/command/register/types";
import { measureTakumiHtml } from "../../../src/render/takumi";

const logger = { warn: vi.fn() } as unknown as ReturnType<Context["logger"]>;

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

function decodePngSize(buffer: Buffer): { width: number; height: number } {
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

  it("别名换行导致行高不一致时仍应满足页高上限", async () => {
    const aliases = Array.from({ length: 120 }, (_, index) =>
      index % 7 === 0 ? `很长的模板别名${index}`.repeat(4) : `模板${index}`,
    );
    const pages = await paginateMemeListImageSections([
      { title: "图片+文字", aliases },
    ]);

    expect(flattenAliases(pages)).toEqual(aliases);
    for (const page of pages) {
      const height = await measureTakumiHtml(
        buildMemeListImageHtml(page),
        MEME_LIST_IMAGE_LAYOUT_WIDTH,
      );
      expect(height).toBeLessThanOrEqual(MEME_LIST_IMAGE_PAGE_MAX_HEIGHT);
    }
  });

  it("分类跨页时应在网格整行处切分", async () => {
    const columns = resolveMemeListImageColumns();
    const pages = await paginateMemeListImageSections(createSections(240));
    const blocks = pages.flat();

    for (let index = 0; index < blocks.length - 1; index += 1) {
      if (blocks[index + 1].title.endsWith("（续）")) {
        expect(blocks[index].aliases.length % columns).toBe(0);
      }
    }
  });

  it("分类跨页时标题应带续页标记", async () => {
    const pages = await paginateMemeListImageSections(createSections(240));
    const titles = pages.flatMap((page) => page.map((block) => block.title));

    expect(titles.some((title) => title.endsWith("（续）"))).toBe(true);
  });

  it("应按设备像素比出图，宽度等于布局宽度乘以倍率", async () => {
    const images = await buildListImages(
      createSections(20),
      ["图片+文字", "模板0 模板1"],
      "single",
      logger,
    );

    expect(images).toHaveLength(1);
    const { width, height } = decodePngSize(images![0]);
    expect(width).toBe(
      MEME_LIST_IMAGE_LAYOUT_WIDTH * MEME_LIST_IMAGE_DEVICE_SCALE_FACTOR,
    );
    expect(height).toBeGreaterThan(0);
  });

  it("单张模式下长列表应合成一张超过页高的长图", async () => {
    const images = await buildListImages(
      createSections(240),
      [],
      "single",
      logger,
    );

    expect(images).toHaveLength(1);
    expect(decodePngSize(images![0]).height).toBeGreaterThan(
      MEME_LIST_IMAGE_PAGE_MAX_HEIGHT * MEME_LIST_IMAGE_DEVICE_SCALE_FACTOR,
    );
  });

  it("多张模式下长列表应按页输出多张图片，且每张不超过页高", async () => {
    const images = await buildListImages(
      createSections(240),
      [],
      "multiple",
      logger,
    );

    expect(images!.length).toBeGreaterThan(1);
    for (const image of images!) {
      expect(decodePngSize(image).height).toBeLessThanOrEqual(
        MEME_LIST_IMAGE_PAGE_MAX_HEIGHT * MEME_LIST_IMAGE_DEVICE_SCALE_FACTOR,
      );
    }
  });

  it("图片消息应把每张图片拼成 data URL 图片段", () => {
    const message = formatMemeListImageMessage([
      Buffer.from("a"),
      Buffer.from("b"),
    ]);

    expect(message).toBe(
      `<img src="data:image/png;base64,${Buffer.from("a").toString("base64")}"/>` +
        `<img src="data:image/png;base64,${Buffer.from("b").toString("base64")}"/>`,
    );
  });
});
