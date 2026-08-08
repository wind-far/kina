const MAX_IMPORT_WARNING_LINES = 50

/** 将导入兼容警告规范为可安全展示、不会淹没用户的迁移报告。 */
export const formatCanvasImportMigrationReport = (warnings: unknown) => {
  const normalized = Array.isArray(warnings)
    ? [...new Set(warnings.map(item => String(item || '').trim()).filter(Boolean))]
    : []
  if (!normalized.length) return ''

  const visible = normalized.slice(0, MAX_IMPORT_WARNING_LINES)
  const suffix = normalized.length > visible.length
    ? `\n\n另有 ${normalized.length - visible.length} 项同类问题未展开。`
    : ''
  return `本次导入已尽量保留原始数据。以下项目需要确认：\n\n${visible.map((item, index) => `${index + 1}. ${item}`).join('\n')}${suffix}`
}
