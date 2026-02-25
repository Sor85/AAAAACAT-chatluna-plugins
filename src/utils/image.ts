/**
 * 图片提取与下载工具
 * 负责从消息元素读取图片并转为二进制输入
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Context } from "koishi";
import type { GenerateImageInput } from "../types";

interface ElementLike {
  type?: string;
  attrs?: {
    src?: unknown;
  };
  children?: ElementLike[];
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const LOCAL_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

export function extractImageSources(
  elements: readonly ElementLike[] = [],
): string[] {
  const result: string[] = [];

  const walk = (nodes: readonly ElementLike[]): void => {
    for (const node of nodes) {
      if (node.type === "img" && node.attrs?.src) {
        result.push(String(node.attrs.src));
      }

      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  };

  walk(elements);
  return result;
}

export async function downloadImage(
  ctx: Context,
  src: string,
  timeoutMs: number,
  filenamePrefix = "image",
): Promise<GenerateImageInput> {
  const safeUrl = await assertSafeRemoteUrl(src);
  const response = await ctx.http("GET", safeUrl.toString(), {
    timeout: timeoutMs,
    responseType: "stream",
  });

  const contentLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    throw new Error("图片体积超过限制");
  }

  const data = await readStreamWithLimit(response.data, MAX_IMAGE_BYTES);
  const mimeType =
    normalizeMimeType(response.headers.get("content-type")) ||
    guessMimeTypeFromSrc(safeUrl.toString());

  return {
    data,
    mimeType,
    filename: `${filenamePrefix}.${mimeTypeToExtension(mimeType)}`,
  };
}

async function assertSafeRemoteUrl(src: string): Promise<URL> {
  const url = new URL(src);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("仅支持 http/https 图片地址");
  }

  const hostname = url.hostname.toLowerCase();
  if (LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error("不允许访问本地地址");
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isPrivateIpv4(hostname)) {
    throw new Error("不允许访问内网 IPv4 地址");
  }

  if (ipVersion === 6 && isPrivateIpv6(hostname)) {
    throw new Error("不允许访问内网 IPv6 地址");
  }

  if (!ipVersion) {
    const records = await lookup(hostname, { all: true });
    const hasPrivateAddress = records.some((record) => {
      if (record.family === 4) return isPrivateIpv4(record.address);
      return isPrivateIpv6(record.address);
    });

    if (hasPrivateAddress) {
      throw new Error("不允许访问解析到内网的地址");
    }
  }

  return url;
}

function readStreamWithLimit(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  const run = async (): Promise<Uint8Array> => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("图片体积超过限制");
      }

      chunks.push(value);
    }

    const merged = new Uint8Array(total);
    let offset = 0;

    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return merged;
  };

  return run();
}

function normalizeMimeType(contentType: string | null): string | undefined {
  if (!contentType) return undefined;

  const mimeType = contentType.split(";")[0]?.trim().toLowerCase();
  if (!mimeType) return undefined;

  if (mimeType === "image/png") return mimeType;
  if (mimeType === "image/jpeg") return mimeType;
  if (mimeType === "image/gif") return mimeType;
  if (mimeType === "image/webp") return mimeType;

  return undefined;
}

function guessMimeTypeFromSrc(src: string): string {
  const lower = src.toLowerCase();

  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";

  return "image/png";
}

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";

  return "bin";
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    return true;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;

  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8")) return true;
  if (normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea")) return true;
  if (normalized.startsWith("feb")) return true;

  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.replace("::ffff:", "");
    return isPrivateIpv4(mapped);
  }

  return false;
}
