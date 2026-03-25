/**
 * 日志工具
 * 提供统一的日志记录接口，支持按配置开关调试日志
 */

import type { Context } from 'koishi'
import type { LogFn, LogLevel } from '../types'

interface Logger {
    debug?: (...args: unknown[]) => void
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
    log?: (...args: unknown[]) => void
}

interface LoggerConfig {
    debugLogging?: boolean
}

export function createLogger(ctx: Context, config: LoggerConfig): LogFn {
    const base: Logger = ctx.logger ? ctx.logger('chatluna-affinity') : console

    return (level: LogLevel, message: string, detail?: unknown): void => {
        if (!config.debugLogging && level === 'debug') return

        const writer =
            typeof base?.[level] === 'function'
                ? base[level]!
                : base?.info ?? base?.log ?? console.log

        if (detail === undefined) {
            writer.call(base, message)
        } else {
            writer.call(base, message, detail)
        }
    }
}
