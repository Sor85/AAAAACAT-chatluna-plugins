/**
 * 后端错误映射
 * 将状态码和网络异常转换为可读提示
 */

export function mapBackendStatus(status?: number, detail?: string): string {
  if (!status) {
    return detail || '后端返回异常，未提供状态码。'
  }

  if (status === 531) {
    return detail || '模板不存在。'
  }

  if (status === 541) {
    return detail || '输入图片数量不符合模板要求。'
  }

  if (status === 542) {
    return detail || '输入文字数量不符合模板要求。'
  }

  if (status === 543) {
    return detail || '文字内容不足，无法生成。'
  }

  if (status === 551 || status === 552) {
    return detail || '参数不合法，请检查输入。'
  }

  if (status >= 500) {
    return detail || '后端服务异常，请稍后再试。'
  }

  return detail || `请求失败（${status}）。`
}

export function mapNetworkError(error: unknown): string {
  if (error instanceof Error) {
    return `后端不可用或超时：${error.message}`
  }

  return '后端不可用或超时。'
}
