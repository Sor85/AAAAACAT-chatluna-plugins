/**
 * 渲染器基础工具
 * 提供 Puppeteer 类型定义和通用渲染函数
 */

import type { Context } from 'koishi'
import type { LogFn } from '../types'

export interface Puppeteer {
    page: () => Promise<Page>
}

export interface Page {
    setViewport: (options: {
        width: number
        height: number
        deviceScaleFactor?: number
    }) => Promise<void>
    setContent: (html: string, options: { waitUntil: string }) => Promise<void>
    $: (selector: string) => Promise<Element | null>
    close: () => Promise<void>
}

export interface Element {
    screenshot: (options: { omitBackground: boolean }) => Promise<Buffer>
}

export interface RenderOptions {
    width?: number
    height?: number
    deviceScaleFactor?: number
    selector?: string
}

export function getPuppeteer(ctx: Context): Puppeteer | null {
    return (ctx as unknown as { puppeteer?: Puppeteer }).puppeteer || null
}

export async function renderHtml(
    ctx: Context,
    html: string,
    options: RenderOptions,
    log?: LogFn
): Promise<Buffer | null> {
    const puppeteer = getPuppeteer(ctx)
    if (!puppeteer?.page) return null

    const {
        width = 600,
        height = 400,
        deviceScaleFactor = 2,
        selector = '#root'
    } = options

    let page: Page | undefined
    try {
        page = await puppeteer.page()
        await page.setViewport({ width, height, deviceScaleFactor })
        await page.setContent(html, { waitUntil: 'networkidle0' })
        const element = await page.$(selector)
        if (!element) return null
        return await element.screenshot({ omitBackground: false })
    } catch (error) {
        log?.('warn', '图片渲染失败', error)
        return null
    } finally {
        try {
            await page?.close()
        } catch {
            // ignore
        }
    }
}

export function escapeHtmlForRender(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}
