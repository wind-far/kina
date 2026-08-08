import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { deleteUploadedStorageFile } from '../../server/storage/service.ts'

const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'canvasmind-import-cleanup-'))
const previousUploadsDir = process.env.UPLOADS_DIR
process.env.UPLOADS_DIR = uploadsDir

try {
  const relativePath = 'canvas-import/test-project/asset.png'
  const filePath = path.join(uploadsDir, relativePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, Buffer.from('fixture'))
  assert.equal(await deleteUploadedStorageFile({ relativePath, storageType: 'local' }), true)
  await assert.rejects(
    () => deleteUploadedStorageFile({ relativePath: '../outside.png', storageType: 'local' }),
    /路径不合法/,
  )
} finally {
  if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR
  else process.env.UPLOADS_DIR = previousUploadsDir
  await fs.rm(uploadsDir, { recursive: true, force: true })
}

const archiveServiceSource = await fs.readFile(new URL('../../server/canvas-projects/service.ts', import.meta.url), 'utf8')
assert.match(archiveServiceSource, /cleanupFailedCanvasArchiveProjectUploads/)
assert.match(archiveServiceSource, /await cleanupFailedCanvasArchiveProjectUploads\(uploadedReferences, warnings, projectIndex\)/)

console.log('canvas archive cleanup regression passed')
