/**
 * 字符串工具函数
 * 包含前缀处理、清理等函数
 */

export function stripAtPrefix(text: string | unknown): string {
    const value = String(text ?? '').trim()
    if (!value) return ''

    const mentionMatch = value.match(/^<@!?(.+)>$/)
    if (mentionMatch) return mentionMatch[1]

    const decoded = value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')

    const atTagMatch = decoded.match(
        /<at\s+[^>]*(?:id|qq)\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/i
    )
    if (atTagMatch) return atTagMatch[1]

    return value.replace(/^[@＠]+/, '').trim() || decoded
}

export function sanitizeChannel(value: unknown): string {
    return String(value ?? '').trim()
}

export function pickFirst<T>(...values: (T | undefined | null)[]): T | undefined {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') {
            return value
        }
    }
    return undefined
}

export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - suffix.length) + suffix
}

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}
