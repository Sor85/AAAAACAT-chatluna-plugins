/**
 * 指令输入解析
 * 统一提取文本参数、图片元素与引用消息图片
 */

import type { Context, Session } from 'koishi'
import type { Config } from '../config'
import type { GenerateImageInput } from '../types'
import { downloadImage, extractImageSources } from '../utils/image'

export interface ParsedInput {
  texts: string[]
  images: GenerateImageInput[]
}

export async function parseCommandInput(
  ctx: Context,
  session: Session,
  rawTexts: string[],
  config: Config,
): Promise<ParsedInput> {
  const texts = rawTexts.map((text) => text.trim()).filter(Boolean)

  const currentImages = extractImageSources(session.elements)
  const quotedImages = extractImageSources(session.quote?.elements || [])
  const imageSources = [...currentImages, ...quotedImages]

  const images: GenerateImageInput[] = []

  for (let index = 0; index < imageSources.length; index += 1) {
    const src = imageSources[index]
    const image = await downloadImage(ctx, src, config.timeoutMs, `input-${index + 1}`)
    images.push(image)
  }

  return { texts, images }
}
