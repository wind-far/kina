import type { ResearchOutlineSection } from '../../src/shared/research/research-types'

const normalizeSectionHeading = (value: string) => {
  return String(value || '')
    .replace(/^\s{0,3}#{1,6}\s+/u, '')
    .replace(/\s+#+\s*$/u, '')
    .replace(/^[一二三四五六七八九十\d]+[、.．]\s*/u, '')
    .replace(/\s+/g, ' ')
    .replace(/[：:]\s*$/u, '')
    .trim()
    .toLowerCase()
}

export const stripDuplicateSectionHeading = (content: string, title: string) => {
  const expectedTitle = normalizeSectionHeading(title)
  let normalizedContent = String(content || '').trim()
  if (!expectedTitle || !normalizedContent) {
    return normalizedContent
  }

  while (normalizedContent) {
    const headingMatch = normalizedContent.match(/^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*(?:\r?\n|$)/u)
    if (!headingMatch) {
      break
    }

    const headingTitle = normalizeSectionHeading(headingMatch[2] || '')
    if (headingTitle !== expectedTitle) {
      break
    }

    normalizedContent = normalizedContent.slice(headingMatch[0].length).trimStart()
  }

  return normalizedContent.trim()
}

export const buildResearchSectionDelta = (section: ResearchOutlineSection, sectionBody: string) => {
  const normalizedBody = stripDuplicateSectionHeading(sectionBody, section.title)
  return `## ${section.title}\n\n${normalizedBody}\n\n`
}
