/**
 * 模板工具函数
 * 包含简单模板字符串渲染
 */

export function renderTemplate(
    template: string,
    vars: Record<string, string | number>
): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
        return key in vars ? String(vars[key]) : `{${key}}`
    })
}
