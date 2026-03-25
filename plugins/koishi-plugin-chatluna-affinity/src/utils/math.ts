/**
 * 数学工具函数
 * 包含数值范围限制等函数
 */

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

export function clampFloat(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

export function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

export function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
}
