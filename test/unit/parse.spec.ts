/**
 * 输入解析单元测试
 * 校验文本清理与图片元素提取行为
 */

import { describe, expect, it } from 'vitest'
import { extractImageSources } from '../../src/utils/image'

describe('extractImageSources', () => {
  it('提取消息中的 img src', () => {
    const elements = [
      { type: 'text', attrs: { content: 'hello' }, children: [] },
      { type: 'img', attrs: { src: 'https://a.com/1.png' }, children: [] },
      { type: 'img', attrs: { src: 'https://a.com/2.jpg' }, children: [] },
    ] as never[]

    const result = extractImageSources(elements)
    expect(result).toEqual(['https://a.com/1.png', 'https://a.com/2.jpg'])
  })

  it('忽略无 src 的 img 与非 img 元素', () => {
    const elements = [
      { type: 'img', attrs: {}, children: [] },
      { type: 'at', attrs: { id: '1' }, children: [] },
      { type: 'text', attrs: { content: 'x' }, children: [] },
    ] as never[]

    const result = extractImageSources(elements)
    expect(result).toEqual([])
  })
})
