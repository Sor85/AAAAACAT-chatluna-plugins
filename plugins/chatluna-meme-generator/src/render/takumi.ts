/**
 * Takumi HTML 渲染工具
 * 复用渲染器，并显式加载中韩文字体和远程图片资源
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  Renderer,
  type ImageSource,
  type MeasuredNode,
  type Node,
} from "@takumi-rs/core";
import { extractEmojis } from "@takumi-rs/helpers/emoji";
import { fromHtml } from "@takumi-rs/helpers/html";

const fonts = [
  "@fontsource-variable/noto-sans-sc",
  "@fontsource-variable/noto-sans-kr",
].flatMap((fontPackage, packageIndex) => {
  const fontDirectory = resolve(
    dirname(require.resolve(`${fontPackage}/package.json`)),
    "files",
  );
  return readdirSync(fontDirectory)
    .filter((name) => name.endsWith(".woff2"))
    .sort()
    .map((name, fontIndex) => ({
      name: `NotoSans${packageIndex}_${fontIndex}`,
      data: readFileSync(resolve(fontDirectory, name)),
    }));
});
const fontFamily = fonts.map((font) => `'${font.name}'`).join(",");
const renderer = new Renderer({ fonts, loadDefaultFonts: true });

function parseHtml(html: string) {
  const stylesheets: string[] = [];
  const content = html.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_, stylesheet: string) => {
      stylesheets.push(stylesheet);
      return "";
    },
  );
  const parsed = fromHtml(content);
  return {
    node: parsed.node,
    stylesheets: [...parsed.stylesheets, ...stylesheets].map((stylesheet) =>
      stylesheet.replaceAll('"Noto Sans SC"', fontFamily),
    ),
  };
}

const REMOTE_IMAGE_CACHE_LIMIT = 256;
const remoteImageCache = new Map<string, Promise<ImageSource | null>>();

function loadRemoteImage(src: string): Promise<ImageSource | null> {
  const cached = remoteImageCache.get(src);
  if (cached) {
    // 命中后移到末尾，按最近使用顺序淘汰
    remoteImageCache.delete(src);
    remoteImageCache.set(src, cached);
    return cached;
  }

  const promise = (async (): Promise<ImageSource | null> => {
    try {
      const response = await fetch(src);
      if (!response.ok) return null;
      return { src, data: await response.arrayBuffer() };
    } catch {
      return null;
    }
  })();

  // 表情等资源会在测量与渲染中被反复用到，缓存起来避免重复下载
  if (remoteImageCache.size >= REMOTE_IMAGE_CACHE_LIMIT) {
    const oldest = remoteImageCache.keys().next().value;
    if (oldest !== undefined) remoteImageCache.delete(oldest);
  }
  remoteImageCache.set(src, promise);

  // 下载失败不缓存，下次渲染重新拉取，避免一次网络抖动让资源长期缺失
  void promise.then((image) => {
    if (!image && remoteImageCache.get(src) === promise) {
      remoteImageCache.delete(src);
    }
  });

  return promise;
}

async function fetchRemoteImages(node: Node): Promise<ImageSource[]> {
  const urls = new Set<string>();

  function collect(current: Node): void {
    if (current.type === "image" && typeof current.src === "string") {
      try {
        const url = new URL(current.src);
        if (url.protocol === "http:" || url.protocol === "https:") {
          urls.add(current.src);
        }
      } catch {
        // Takumi 会自行处理非远程图片来源
      }
    }

    if (current.type === "container") {
      current.children?.forEach(collect);
    }
  }

  collect(node);
  const images = await Promise.all(
    [...urls].map(async (src) => await loadRemoteImage(src)),
  );
  return images.filter((image): image is ImageSource => image !== null);
}

export interface TakumiRenderOptions {
  /**
   * 渲染倍率。1 表示按 CSS 像素直接出图（默认），2 表示两倍密度的视网膜渲染。
   */
  deviceScaleFactor?: number;
}

function normalizeDeviceScaleFactor(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return 1;
  return value as number;
}

function prepare(html: string) {
  const parsed = parseHtml(html);
  const node = extractEmojis(parsed.node, "twemoji");
  return { node, stylesheets: parsed.stylesheets };
}

/**
 * 按 CSS 宽度测量布局，返回包含各子节点尺寸与位置的节点树（单位：CSS 像素）。
 */
export async function measureTakumiLayout(
  html: string,
  width: number,
): Promise<MeasuredNode> {
  const prepared = prepare(html);
  const images = await fetchRemoteImages(prepared.node);

  return await renderer.measure(prepared.node, {
    width,
    stylesheets: prepared.stylesheets,
    fetchedResources: images,
  });
}

/**
 * 按 CSS 宽度测量渲染结果高度（单位：CSS 像素）。
 */
export async function measureTakumiHtml(
  html: string,
  width: number,
): Promise<number> {
  const measured = await measureTakumiLayout(html, width);
  return Math.ceil(measured.height);
}

export async function renderTakumiHtml(
  html: string,
  width: number,
  options: TakumiRenderOptions = {},
): Promise<Buffer> {
  const deviceScaleFactor = normalizeDeviceScaleFactor(options.deviceScaleFactor);
  const prepared = prepare(html);
  const images = await fetchRemoteImages(prepared.node);

  return renderer.render(prepared.node, {
    // width 是物理像素宽度，布局宽度 = width / devicePixelRatio
    width: Math.round(width * deviceScaleFactor),
    devicePixelRatio: deviceScaleFactor,
    format: "png",
    stylesheets: prepared.stylesheets,
    fetchedResources: images,
  });
}
