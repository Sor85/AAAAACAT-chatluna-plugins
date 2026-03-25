/**
 * 黑名单渲染器
 * 渲染黑名单列表图片
 */

import type { Context } from 'koishi'
import type { LogFn } from '../types'
import { renderHtml } from './base'
import { COMMON_STYLE } from './styles'

export interface BlacklistItem {
    index: number
    nickname: string
    userId: string
    timeInfo: string
    note: string
    avatarUrl?: string
    isTemp?: boolean
    penalty?: number
    tag?: string
}

const BLACKLIST_STYLE = `
    ${COMMON_STYLE}
    .note {
      font-size: 13px;
      color: #6b7280;
      margin-top: 4px;
    }
`

function buildBlacklistHtml(title: string, items: BlacklistItem[]): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>${BLACKLIST_STYLE}</style>
</head>
<body>
  <div class="container" id="list-root">
    <div class="header">
      <h1>${title}</h1>
    </div>
    ${items
        .map(
            (item) => `
    <div class="card">
      <div class="rank-num" style="font-size: 16px; color: #9ca3af; width: 24px;">${item.index}</div>
      ${
          item.avatarUrl
              ? `<img class="avatar" src="${item.avatarUrl}" onerror="this.style.display='none'" />`
              : `<div class="avatar-placeholder">${item.nickname.charAt(0)}</div>`
      }
      <div class="info">
        <div class="name-row">
          <span class="name">${item.nickname}</span>
          ${item.tag ? `<span class="badge ${item.isTemp ? 'badge-orange' : 'badge-red'}" style="margin-left: 4px;">${item.tag}</span>` : ''}
        </div>
        <div class="sub-text">${item.userId}</div>
        ${item.note && item.note !== '——' ? `<div class="note">备注: ${item.note}</div>` : ''}
      </div>
      <div class="value-container">
        <div class="value-secondary">${item.timeInfo}</div>
        ${item.isTemp && item.penalty ? `<div class="badge badge-red" style="margin-top: 4px;">扣除 ${item.penalty} 好感</div>` : ''}
      </div>
    </div>
    `
        )
        .join('')}
  </div>
</body>
</html>`
}

export function createBlacklistRenderer(ctx: Context, log?: LogFn) {
    return async function renderBlacklist(
        title: string,
        items: BlacklistItem[]
    ): Promise<Buffer | null> {
        const html = buildBlacklistHtml(title, items)
        return renderHtml(
            ctx,
            html,
            {
                width: 600,
                height: 100 + items.length * 120,
                selector: '#list-root'
            },
            log
        )
    }
}

export type BlacklistRenderer = ReturnType<typeof createBlacklistRenderer>
