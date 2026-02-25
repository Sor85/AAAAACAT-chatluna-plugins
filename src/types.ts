/**
 * 插件通用类型定义
 * 统一后端接口数据结构与生成请求结构
 */

export interface MemeShortcut {
  key: string
  args?: string[]
  humanized?: string
}

export interface MemeParamsType {
  min_images: number
  max_images: number
  min_texts: number
  max_texts: number
  default_texts: string[]
}

export interface MemeInfoResponse {
  key: string
  params_type: MemeParamsType
  keywords: string[]
  shortcuts: MemeShortcut[]
  tags: string[]
  date_created: string
  date_modified: string
}

export interface GenerateImageInput {
  data: Uint8Array
  filename: string
  mimeType: string
}

export interface BinaryResult {
  buffer: Uint8Array
  mimeType: string
}
