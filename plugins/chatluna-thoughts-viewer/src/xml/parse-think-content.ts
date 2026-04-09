/**
 * XML 标签内容解析
 * 按指定标签名提取标签内部文本
 */

import type { ParseTagContentResult } from "../types";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseTagContent(
  text: string,
  tagName: string,
): ParseTagContentResult {
  if (!text) {
    return {
      thoughts: [],
    };
  }

  const normalizedTagName = String(tagName || "").trim();
  if (!normalizedTagName) {
    return {
      thoughts: [],
    };
  }

  const tagPattern = new RegExp(
    `<${escapeRegExp(normalizedTagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(normalizedTagName)}\\s*>`,
    "gi",
  );

  const thoughts = Array.from(text.matchAll(tagPattern)).map(
    (match) => match[1] ?? "",
  );

  return {
    thoughts,
  };
}
