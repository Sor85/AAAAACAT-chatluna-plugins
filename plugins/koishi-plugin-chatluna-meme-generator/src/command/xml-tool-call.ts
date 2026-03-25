/**
 * XML 工具调用解析
 * 仅支持 <meme key="..." text="..." image"..." at="..."/>
 */

export interface XmlMemeToolCall {
  key: string;
  texts: string[];
  imageSources: string[];
  atUserIds: string[];
}

const MEME_XML_TAG_PATTERN = /<meme\s+([^>]*?)\s*\/?>(?:<\/meme>)?/gi;
const XML_ATTRIBUTE_PATTERN = /([a-zA-Z_][\w:-]*)\s*=\s*"([^"]*)"/g;
const XML_ATTR_WITHOUT_EQUALS_PATTERN =
  /(?:^|\s)([a-zA-Z_][\w:-]*)\s*"([^"]*)"/g;
const SUPPORTED_ATTRIBUTES = new Set(["key", "text", "image", "at"]);

function unescapeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalizeToolValue(value: string): string {
  return unescapeXml(value).trim();
}

function splitByPipe(raw: string): string[] {
  return normalizeToolValue(raw)
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseAttributes(rawAttributes: string): Map<string, string> {
  const result = new Map<string, string>();

  for (const match of rawAttributes.matchAll(XML_ATTRIBUTE_PATTERN)) {
    const rawName = String(match[1] ?? "")
      .trim()
      .toLowerCase();
    const rawValue = String(match[2] ?? "");
    if (!rawName) continue;
    result.set(rawName, rawValue);
  }

  for (const match of rawAttributes.matchAll(XML_ATTR_WITHOUT_EQUALS_PATTERN)) {
    const rawName = String(match[1] ?? "")
      .trim()
      .toLowerCase();
    const rawValue = String(match[2] ?? "");
    if (!rawName || result.has(rawName)) continue;
    result.set(rawName, rawValue);
  }

  return result;
}

function hasUnsupportedAttributes(attributes: Map<string, string>): boolean {
  for (const key of attributes.keys()) {
    if (!SUPPORTED_ATTRIBUTES.has(key)) return true;
  }
  return false;
}

function hasRequiredAttributes(attributes: Map<string, string>): boolean {
  return attributes.has("key");
}

function normalizeUserId(value: string): string {
  return value.replace(/^@+/, "").trim();
}

export function extractXmlMemeToolCalls(content: string): XmlMemeToolCall[] {
  if (!content) return [];

  const results: XmlMemeToolCall[] = [];
  const dedupe = new Set<string>();

  for (const match of content.matchAll(MEME_XML_TAG_PATTERN)) {
    const attributes = parseAttributes(String(match[1] ?? ""));
    if (hasUnsupportedAttributes(attributes)) continue;
    if (!hasRequiredAttributes(attributes)) continue;

    const key = normalizeToolValue(attributes.get("key") ?? "");
    const texts = splitByPipe(attributes.get("text") ?? "");
    const imageSources = splitByPipe(attributes.get("image") ?? "");
    const atUserIds = splitByPipe(attributes.get("at") ?? "")
      .map((userId) => normalizeUserId(userId))
      .filter(Boolean);

    if (!key) continue;

    const signature = `${key}\u0000${texts.join("\u0000")}\u0000${imageSources.join("\u0000")}\u0000${atUserIds.join("\u0000")}`;
    if (dedupe.has(signature)) continue;

    dedupe.add(signature);
    results.push({ key, texts, imageSources, atUserIds });
  }

  return results;
}
