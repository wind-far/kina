import { readRawBuffer, sendJson } from '../ai-gateway/shared'
import { requireCurrentSessionUser } from '../auth/session'
import { saveUploadedBuffer } from './service'

const VIDEO_REFERENCE_IMAGE_MAX_BYTES = 20 * 1024 * 1024

// 处理文件上传请求。
export const handleStorageUploadRequest = async (req: any, res: any) => {
  try {
    // 仅允许 POST 上传。
    if (req.method !== 'POST') {
      sendJson(res, 405, {
        message: 'Method Not Allowed',
        error: {
          type: 'storage_upload_error',
          message: 'Method Not Allowed',
        },
      })
      return
    }

    // 视频参考图使用独立分类，只对该类素材收紧类型与大小，避免影响普通大视频/音频上传。
    const category = String(req.headers['x-upload-category'] || 'general').trim()
    const mimeType = String(req.headers['content-type'] || 'application/octet-stream').trim()
    const normalizedMimeType = mimeType.split(';')[0].trim().toLowerCase()
    const isVideoReferenceImage = category === 'reference'
    // 参考图会生成供应商可访问地址，因此必须绑定已登录用户；保留安装页等既有上传流程的兼容性。
    if (isVideoReferenceImage) {
      const currentUser = await requireCurrentSessionUser(req, res)
      if (!currentUser) return
    }

    if (isVideoReferenceImage && !normalizedMimeType.startsWith('image/')) {
      sendJson(res, 415, { message: '视频参考素材必须是图片', error: { type: 'storage_upload_error', message: '视频参考素材必须是图片' } })
      return
    }

    const contentLength = Number(req.headers?.['content-length'] || 0)
    if (isVideoReferenceImage && Number.isFinite(contentLength) && contentLength > VIDEO_REFERENCE_IMAGE_MAX_BYTES) {
      sendJson(res, 413, { message: '上传文件不能超过 20MB', error: { type: 'storage_upload_error', message: '上传文件不能超过 20MB' } })
      return
    }

    // 读取请求体原始二进制内容。
    const buffer = await readRawBuffer(req, isVideoReferenceImage ? VIDEO_REFERENCE_IMAGE_MAX_BYTES : Number.POSITIVE_INFINITY)

    // 空文件直接拒绝。
    if (!buffer.byteLength) {
      sendJson(res, 400, {
        message: '上传内容不能为空',
        error: {
          type: 'storage_upload_error',
          message: '上传内容不能为空',
        },
      })
      return
    }

    // 从请求头读取文件名。
    const filename = String(req.headers['x-upload-filename'] || '').trim()

    // 保存文件到本地上传目录。
    const savedFile = await saveUploadedBuffer({
      buffer,
      filename,
      mimeType,
      category,
    })

    // 返回上传结果。
    sendJson(res, 200, {
      data: savedFile,
      message: '上传成功',
    })
  } catch (error: any) {
    const sizeExceeded = error?.message === '请求体大小超过限制'
    // 返回统一错误结构。
    sendJson(res, sizeExceeded ? 413 : 500, {
      message: sizeExceeded ? '上传文件不能超过 20MB' : error?.message || '文件上传失败',
      error: {
        type: 'storage_upload_error',
        message: sizeExceeded ? '上传文件不能超过 20MB' : error?.message || '文件上传失败',
      },
    })
  }
}
