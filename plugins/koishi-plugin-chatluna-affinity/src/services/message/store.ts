/**
 * 消息存储
 * 提供带消息 ID 的消息存储，支持按内容或位置查找消息
 */

import type { Context, Session } from 'koishi'
import type { LogFn } from '../../types'

export interface StoredMessage {
    messageId: string
    userId: string
    username: string
    content: string
    timestamp: number
}

export interface MessageStoreOptions {
    ctx: Context
    log: LogFn
    limit?: number
}

export function createMessageStore(options: MessageStoreOptions) {
    const { ctx, log, limit = 100 } = options
    const cache = new Map<string, StoredMessage[]>()

    const makeKey = (session: Session | null | undefined): string => {
        if (!session) return 'unknown'
        const platform = session.platform || 'unknown'
        const selfId = session.selfId || 'self'
        const guildId = (session as unknown as { guildId?: string })?.guildId || ''
        const channelId =
            session.channelId || (session as unknown as { roomId?: string })?.roomId || ''

        if (guildId) {
            return `${platform}:${selfId}:${guildId}:${channelId || guildId}`
        }
        return `${platform}:${selfId}:direct:${channelId || session.userId || 'unknown'}`
    }

    const extractMessageId = (session: Session): string => {
        const candidates = [
            session.messageId,
            (session as unknown as { id?: string })?.id,
            (session as unknown as { event?: { message?: { id?: string } } })?.event?.message?.id,
            (session as unknown as { message?: { id?: string } })?.message?.id
        ]
        for (const id of candidates) {
            if (typeof id === 'string' && id.trim()) return id.trim()
            if (typeof id === 'number') return String(id)
        }
        return ''
    }

    const extractUsername = (session: Session): string => {
        const candidates = [
            session.username,
            (session as unknown as { author?: { name?: string; nickname?: string } })?.author?.name,
            (session as unknown as { author?: { name?: string; nickname?: string } })?.author
                ?.nickname,
            (session as unknown as { event?: { user?: { name?: string } } })?.event?.user?.name,
            (session as unknown as { user?: { name?: string } })?.user?.name,
            session.userId
        ]
        for (const name of candidates) {
            if (typeof name === 'string' && name.trim()) return name.trim()
        }
        return '未知用户'
    }

    const record = (session: Session): void => {
        if (!session?.platform) return

        const messageId = extractMessageId(session)
        if (!messageId) return

        const userId = session.userId || ''
        if (!userId) return

        const key = makeKey(session)
        const list = cache.get(key) || []

        const entry: StoredMessage = {
            messageId,
            userId,
            username: extractUsername(session),
            content: typeof session.content === 'string' ? session.content.slice(0, 200) : '',
            timestamp: new Date(session.timestamp ?? Date.now()).getTime()
        }

        list.push(entry)

        if (list.length > limit) {
            list.splice(0, list.length - limit)
        }

        cache.set(key, list)
        log('debug', '已记录消息', { messageId, userId, key })
    }

    const getMessages = (session: Session, count = 50): StoredMessage[] => {
        const key = makeKey(session)
        const list = cache.get(key) || []
        return list.slice(-count)
    }

    const findByLastN = (
        session: Session,
        lastN: number,
        userId?: string
    ): StoredMessage | null => {
        const key = makeKey(session)
        const list = cache.get(key) || []
        if (!list.length) return null

        let count = 0
        for (let i = list.length - 1; i >= 0; i--) {
            const msg = list[i]
            if (userId && msg.userId !== userId) continue
            count++
            if (count === lastN) {
                return msg
            }
        }
        return null
    }

    const findByIds = (
        session: Session,
        messageIds: string[]
    ): StoredMessage[] => {
        const key = makeKey(session)
        const list = cache.get(key) || []
        if (!list.length || !messageIds.length) return []

        const idSet = new Set(messageIds.map((id) => id.trim()).filter(Boolean))
        return list.filter((msg) => idSet.has(msg.messageId))
    }

    const findByContent = (
        session: Session,
        keyword: string,
        userId?: string
    ): StoredMessage | null => {
        const key = makeKey(session)
        const list = cache.get(key) || []
        if (!list.length || !keyword) return null

        const lowerKeyword = keyword.toLowerCase()

        for (let i = list.length - 1; i >= 0; i--) {
            const msg = list[i]
            if (userId && msg.userId !== userId) continue
            if (msg.content.toLowerCase().includes(lowerKeyword)) {
                return msg
            }
        }
        return null
    }

    const clear = (session: Session): void => {
        const key = makeKey(session)
        cache.delete(key)
    }

    ctx.on('message', record)

    return {
        record,
        getMessages,
        findByLastN,
        findByIds,
        findByContent,
        clear
    }
}

export type MessageStore = ReturnType<typeof createMessageStore>
