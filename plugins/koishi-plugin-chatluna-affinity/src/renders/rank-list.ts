/**
 * 排行榜渲染器
 * 渲染好感度排行榜图片
 */

import type { Context } from 'koishi'
import type { LogFn } from '../types'
import { renderHtml } from './base'
import { COMMON_STYLE } from './styles'

export interface RankItem {
    rank: number
    name: string
    relation: string
    affinity: number
    avatarUrl?: string
}

const RANK_LIST_STYLE = `
    ${COMMON_STYLE}

    .rank-num {
      font-size: 20px;
      font-weight: 700;
      color: #9ca3af;
      width: 32px;
      text-align: center;
      font-feature-settings: "tnum";
    }

    .rank-top-1 { color: #fbbf24; font-size: 24px; }
    .rank-top-2 { color: #9ca3af; font-size: 22px; }
    .rank-top-3 { color: #b45309; font-size: 22px; }

    .affinity-container {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
    }

    .affinity-value {
      font-size: 18px;
      font-weight: 700;
      color: #ec4899;
      font-feature-settings: "tnum";
    }

    .affinity-label {
      font-size: 12px;
      color: #6b7280;
    }

    .relation-badge {
      font-size: 12px;
      padding: 2px 8px;
      background: #e0e7ff;
      color: #4f46e5;
      border-radius: 999px;
      font-weight: 500;
    }
`

function buildRankListHtml(title: string, items: RankItem[]): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>${RANK_LIST_STYLE}</style>
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
      <div class="rank-num rank-top-${item.rank}">${item.rank}</div>
      ${
          item.avatarUrl
              ? `<img class="avatar" src="${item.avatarUrl}" onerror="this.style.display='none'" />`
              : '<div class="avatar" style="background: #e5e7eb"></div>'
      }
      <div class="info">
        <div class="name-row">
          <span class="name">${item.name}</span>
          ${item.relation && item.relation !== '——' ? `<span class="relation-badge">${item.relation}</span>` : ''}
        </div>
      </div>
      <div class="affinity-container">
        <div class="affinity-value">${item.affinity}</div>
        <div class="affinity-label">好感度</div>
      </div>
    </div>
    `
        )
        .join('')}
  </div>
</body>
</html>`
}

export function createRankListRenderer(ctx: Context, log?: LogFn) {
    return async function renderRankList(
        title: string,
        items: RankItem[]
    ): Promise<Buffer | null> {
        const html = buildRankListHtml(title, items)
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

export type RankListRenderer = ReturnType<typeof createRankListRenderer>
