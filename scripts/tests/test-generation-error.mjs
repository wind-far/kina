import assert from 'node:assert/strict'
import { normalizeGenerationErrorMessage } from '../../src/shared/generation-error.ts'

const invalidImageResponse = JSON.stringify({
  error: {
    message: 'invalid input image data',
    type: 'invalid_request_error',
    code: 'invalid_image',
  },
})

assert.equal(
  normalizeGenerationErrorMessage(invalidImageResponse, '图片编辑失败'),
  '参考图数据无效或当前模型无法读取。请重新上传 PNG、JPG 或 WEBP 格式的图片后再试。',
)

console.log('generation error normalization regression passed')
