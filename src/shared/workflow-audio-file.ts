export const WORKFLOW_AUDIO_MAX_BYTES = 100 * 1024 * 1024

export const WORKFLOW_AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.webm'

const WORKFLOW_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'flac',
  'webm',
])

export interface WorkflowAudioFileLike {
  name?: string
  type?: string
  size?: number
}

export const validateWorkflowAudioFile = (file: WorkflowAudioFileLike) => {
  const fileName = String(file.name || '').trim()
  const mimeType = String(file.type || '').trim().toLowerCase()
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : ''
  const size = Number(file.size || 0)

  if (size <= 0) {
    return { valid: false, message: '音频文件不能为空' }
  }

  if (size > WORKFLOW_AUDIO_MAX_BYTES) {
    return { valid: false, message: '音频文件不能超过 100MB' }
  }

  if (!mimeType.startsWith('audio/') && !WORKFLOW_AUDIO_EXTENSIONS.has(extension)) {
    return { valid: false, message: '请选择 MP3、WAV、M4A、AAC、OGG、FLAC 或 WebM 音频文件' }
  }

  return { valid: true, message: '' }
}
