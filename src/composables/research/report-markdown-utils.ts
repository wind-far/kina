// 研究报告渲染相关的纯函数 utils。
// 不持有任何响应式状态，便于在 useReportMarkdown / useCitationRenderer / 子组件中复用。

export const escapeHtml = (value: string): string => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 后端正文里固定附带的 "# Deep Research 执行结果" 标题去掉，避免在前端二次渲染。
export const stripReportHeading = (value: string): string => {
  return value.replace(/^\s*#\s*Deep Research\s*执行结果\s*\n+/i, '')
}

export interface ReportVerificationSplit {
  body: string
  verificationNotes: string
}

// 把报告正文与末尾"核查说明"段拆开，前者用于正文渲染，后者用于核查面板。
export const splitReportVerificationSection = (value: string): ReportVerificationSplit => {
  const normalized = stripReportHeading(String(value || '').replace(/\r\n/g, '\n')).trim()
  const markerMatch = normalized.match(/\n##\s*核查说明\s*\n/i)

  if (!markerMatch || markerMatch.index === undefined) {
    return {
      body: normalized,
      verificationNotes: '',
    }
  }

  return {
    body: normalized.slice(0, markerMatch.index).trim(),
    verificationNotes: normalized.slice(markerMatch.index + markerMatch[0].length).trim(),
  }
}

// 提取链接的可读域名，去掉 www. 前缀；非法 URL 返回空串。
export const readResearchSourceDomain = (url?: string): string => {
  const value = String(url || '').trim()
  if (!value) {
    return ''
  }

  try {
    return new URL(value).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

// 行内 markdown 的轻量渲染：粗体 / 行内代码 / 外链。
// citationRenderer 由调用方注入，用于把 [n] 替换为引用胶囊。
export const renderInlineMarkdown = (
  value: string,
  citationRenderer: (escapedValue: string) => string = (escapedValue) => escapedValue,
): string => {
  return citationRenderer(escapeHtml(value))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

// 把整段 markdown 文本拆成 <p>/<ul>/<h1-4> 块。citationRenderer 用于把 [n] 渲染成引用。
export const renderMarkdownBlocks = (
  value: string,
  citationRenderer: (escapedValue: string) => string = (escapedValue) => escapedValue,
): string => {
  const lines = String(value || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let listItems: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(`<p>${paragraph.map(line => renderInlineMarkdown(line, citationRenderer)).join('<br>')}</p>`)
    paragraph = []
  }

  const flushList = () => {
    if (!listItems.length) return
    blocks.push(`<ul>${listItems.map(item => `<li>${renderInlineMarkdown(item, citationRenderer)}</li>`).join('')}</ul>`)
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const level = Math.min(4, heading[1].length)
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2], citationRenderer)}</h${level}>`)
      continue
    }

    const list = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/)
    if (list) {
      flushParagraph()
      listItems.push(list[1])
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return blocks.join('')
}
