/**
 * 角色映射工具
 * 将各种平台的角色标识转换为统一的中文角色名称
 */

import type { Session } from 'koishi'
import type { RoleTranslation, LogFn } from '../types'
import { ROLE_MAPPING } from '../constants'

export function translateRole(value: unknown): RoleTranslation {
    if (value == null) return { role: '群员', matched: false, raw: value }

    if (Array.isArray(value)) {
        let fallback: RoleTranslation = { role: '群员', matched: false, raw: undefined }
        for (const item of value) {
            const candidate = translateRole(item)
            if (candidate.matched) return candidate
            if (candidate.raw !== undefined && fallback.raw === undefined) {
                fallback = candidate
            }
        }
        return fallback
    }

    if (typeof value === 'object') {
        const keys = [
            'role',
            'roleName',
            'permission',
            'permissions',
            'title',
            'identity',
            'type',
            'level',
            'status',
            'roles'
        ]
        let fallback: RoleTranslation = { role: '群员', matched: false, raw: undefined }
        for (const key of keys) {
            if (!(key in (value as Record<string, unknown>))) continue
            const candidate = translateRole(
                (value as Record<string, unknown>)[key]
            )
            if (candidate.matched) return candidate
            if (candidate.raw !== undefined && fallback.raw === undefined) {
                fallback = candidate
            }
        }
        return fallback
    }

    const text = String(value).trim()
    if (!text) return { role: '群员', matched: false, raw: text }

    const lower = text.toLowerCase()

    if (ROLE_MAPPING.direct[text]) {
        return { role: ROLE_MAPPING.direct[text], matched: true, raw: text }
    }
    if (ROLE_MAPPING.direct[lower]) {
        return { role: ROLE_MAPPING.direct[lower], matched: true, raw: text }
    }

    if (/^\d+$/.test(text)) {
        const mapped = ROLE_MAPPING.numeric[text]
        if (mapped) return { role: mapped, matched: true, raw: text }
    }

    for (const [roleType, keywords] of Object.entries(ROLE_MAPPING.keywords)) {
        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                const role =
                    roleType === 'owner'
                        ? '群主'
                        : roleType === 'admin'
                          ? '管理员'
                          : '群员'
                return { role, matched: true, raw: text }
            }
        }
    }

    if (
        text.includes('群主') ||
        text.includes('房主') ||
        text.includes('会长') ||
        text.includes('团长')
    ) {
        return { role: '群主', matched: true, raw: text }
    }
    if (text.includes('管理员') || text.includes('管理')) {
        return { role: '管理员', matched: true, raw: text }
    }
    if (
        text.includes('群员') ||
        text.includes('成员') ||
        text.includes('普通')
    ) {
        return { role: '群员', matched: true, raw: text }
    }

    return { role: '群员', matched: false, raw: text }
}

interface WithRole {
    role?: unknown
    roleName?: unknown
    permission?: unknown
    permissions?: unknown
    title?: unknown
    identity?: unknown
    type?: unknown
    level?: unknown
    status?: unknown
    roles?: unknown
    member?: unknown
    author?: unknown
    event?: {
        member?: unknown
        sender?: unknown
        operator?: unknown
        self?: unknown
        bot?: unknown
    }
    payload?: { sender?: unknown }
    user?: unknown
    self?: unknown
    bot?: { user?: unknown }
}

export function collectRoleCandidates(
    session: WithRole | null | undefined,
    member: unknown
): unknown[] {
    const candidates: unknown[] = []

    const visit = (value: unknown): void => {
        if (value == null) return
        if (Array.isArray(value)) {
            value.forEach(visit)
            return
        }
        if (typeof value === 'object') {
            const keys = [
                'role',
                'roleName',
                'permission',
                'permissions',
                'title',
                'identity',
                'type',
                'level',
                'status',
                'roles'
            ]
            for (const key of keys) {
                if (key in (value as Record<string, unknown>)) {
                    visit((value as Record<string, unknown>)[key])
                }
            }
            return
        }
        candidates.push(value)
    }

    visit(member)
    visit(session?.member)
    visit(session?.author)
    visit(session?.event?.member)
    visit(session?.event?.sender)
    visit(session?.event?.operator)
    visit(session?.payload?.sender)
    visit(session?.user)
    visit(session?.self)
    visit(session?.bot?.user)
    visit(session?.event?.self)
    visit(session?.event?.bot)

    return candidates
}

interface ResolveRoleLabelOptions {
    logUnknown?: boolean
    logger?: LogFn
}

export function resolveRoleLabel(
    session: Session | null | undefined,
    member: unknown,
    options: ResolveRoleLabelOptions = {}
): string {
    const { logUnknown = false, logger } = options
    const unknownRoles = new Set<string>()
    const candidates = collectRoleCandidates(session as WithRole, member)

    for (const candidate of candidates) {
        const { role, matched, raw } = translateRole(candidate)
        if (matched) return role
        if (
            logUnknown &&
            raw !== undefined &&
            raw !== null &&
            raw !== '' &&
            !unknownRoles.has(String(raw))
        ) {
            unknownRoles.add(String(raw))
            if (typeof logger === 'function') {
                logger('debug', '未识别的群身份', { raw })
            }
        }
    }

    return '群员'
}

export function getRoleDisplay(role: string): string {
    const normalized = translateRole(role)
    return normalized.role
}
