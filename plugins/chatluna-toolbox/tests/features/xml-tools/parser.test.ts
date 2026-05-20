/**
 * XML 解析测试
 * 覆盖自闭合标签与属性提取边界
 */

import { describe, expect, it } from "vitest";
import { parseSelfClosingXmlTags } from "../../../src/features/xml-tools/parser";

describe("parseSelfClosingXmlTags", () => {
  it("解析多个自闭合标签", () => {
    const tags = parseSelfClosingXmlTags(
      '<actions><poke id="u1"/><poke id="u2"/></actions>',
      "poke",
    );

    expect(tags).toEqual([{ id: "u1" }, { id: "u2" }]);
  });

  it("只提取双引号属性", () => {
    const tags = parseSelfClosingXmlTags(
      '<emoji message_id="100" emoji_id="66"/><emoji message_id=\'200\' emoji_id="77"/>',
      "emoji",
    );

    expect(tags).toEqual([
      { message_id: "100", emoji_id: "66" },
      { emoji_id: "77" },
    ]);
  });

  it("忽略非自闭合标签", () => {
    const tags = parseSelfClosingXmlTags(
      '<poke id="u1"></poke><poke id="u2"/>',
      "poke",
    );

    expect(tags).toEqual([{ id: "u2" }]);
  });
});
