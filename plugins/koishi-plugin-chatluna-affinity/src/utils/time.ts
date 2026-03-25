/**
 * 时间工具函数
 * 包含时间格式化、时间戳处理等函数
 */

import { TIME_CONSTANTS } from '../constants'

function pad(n: number): string {
    return String(n).padStart(2, '0')
}

export function normalizeTimestamp(value: unknown): number | null {
    if (!value) return null
    const ts = typeof value === 'number' ? value : parseInt(String(value), 10)
    if (!Number.isFinite(ts)) return null
    return ts < TIME_CONSTANTS.SECONDS_THRESHOLD ? ts * 1000 : ts
}

export function formatTimestamp(value: unknown): string {
    if (!value) return ''
    const ts = value instanceof Date
        ? value.getTime()
        : typeof value === 'number'
            ? value
            : parseInt(String(value), 10)
    if (!Number.isFinite(ts)) return ''
    const date = new Date(ts < TIME_CONSTANTS.SECONDS_THRESHOLD ? ts * 1000 : ts)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

export function formatBeijingTimestamp(date: Date): string {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

export function formatDateOnly(value: unknown): string {
    if (!value) return ''
    const ts = typeof value === 'number' ? value : parseInt(String(value), 10)
    if (!Number.isFinite(ts)) return ''
    const date = new Date(ts < TIME_CONSTANTS.SECONDS_THRESHOLD ? ts * 1000 : ts)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatDateTime(value: unknown): string {
    if (!value) return ''
    const ts = typeof value === 'number' ? value : parseInt(String(value), 10)
    if (!Number.isFinite(ts)) return ''
    const date = new Date(ts < TIME_CONSTANTS.SECONDS_THRESHOLD ? ts * 1000 : ts)
    if (Number.isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hour = pad(date.getHours())
    const minute = pad(date.getMinutes())
    return `${year}-${month}-${day} ${hour}:${minute}`
}

export function toDate(value: unknown): Date | null {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value as string | number)
    return Number.isNaN(date?.valueOf()) ? null : date
}

export function dayNumber(date: Date): number {
    return Math.floor(date.getTime() / TIME_CONSTANTS.MS_PER_DAY)
}

export function getDateString(date: Date, timezone: string = 'Asia/Shanghai'): string {
    return date.toLocaleDateString('zh-CN', { timeZone: timezone })
}

export function getTimeString(date: Date, timezone: string = 'Asia/Shanghai'): string {
    return date.toLocaleTimeString('zh-CN', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit'
    })
}
