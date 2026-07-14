/**
 * Takumi 渲染基础工具
 * 负责复用渲染器、加载中韩文字体并准备远程图片资源
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  Renderer,
  type ImageSource,
  type Node,
} from "@takumi-rs/core";
import { extractEmojis } from "@takumi-rs/helpers/emoji";
import { fromHtml } from "@takumi-rs/helpers/html";
import type { LogFn } from "../types";

export interface RenderOptions {
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
}

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
    [...urls].map(async (src): Promise<ImageSource | null> => {
      try {
        const response = await fetch(src);
        if (!response.ok) return null;
        return { src, data: await response.arrayBuffer() };
      } catch {
        return null;
      }
    }),
  );
  return images.filter((image): image is ImageSource => image !== null);
}

export async function renderHtml(
  html: string,
  options: RenderOptions,
  log?: LogFn,
): Promise<Buffer | null> {
  const {
    width = 600,
    height,
    deviceScaleFactor = 2,
  } = options;

  try {
    const parsed = parseHtml(html);
    const node = extractEmojis(parsed.node, "twemoji");
    const images = await fetchRemoteImages(node);

    return await renderer.render(node, {
      width: width * deviceScaleFactor,
      height: height ? height * deviceScaleFactor : undefined,
      devicePixelRatio: deviceScaleFactor,
      format: "png",
      stylesheets: parsed.stylesheets,
      fetchedResources: images,
    });
  } catch (error) {
    log?.("warn", "图片渲染失败", error);
    return null;
  }
}
