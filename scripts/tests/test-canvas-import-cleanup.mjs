import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { deleteUploadedStorageFile } from '../../server/storage/service.ts'
import { importParsedCanvasProjectArchive } from '../../server/canvas-projects/service.ts'

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
assert.match(archiveServiceSource, /await cleanupFailedCanvasArchiveProjectUploads\(uploadedReferences, warnings, projectIndex, dependencies\.deleteAsset\)/)

const uploaded = []
const deleted = []
const createPayloads = []
const transactionResult = await importParsedCanvasProjectArchive({
  data: {
    app: 'infinite-canvas', version: 3,
    projects: [
      { project: { id: 'will-fail', title: '失败项目', nodes: [{ metadata: { storageKey: 'image:fail' } }] } },
      { project: { id: 'will-succeed', title: '成功项目', nodes: [{ metadata: { storageKey: 'image:ok' } }] } },
    ],
  },
  assets: [
    { projectIndex: 0, storageKey: 'image:fail', path: 'projects/fail.png', mimeType: 'image/png', bytes: 1, buffer: Buffer.from([1]) },
    { projectIndex: 1, storageKey: 'image:ok', path: 'projects/ok.png', mimeType: 'image/png', bytes: 1, buffer: Buffer.from([2]) },
  ],
  projectIndexes: [0, 1],
  warnings: [],
}, undefined, { currentUserId: 'test-user' }, {
  saveAsset: async ({ filename }) => {
    const relativePath = `canvas-import/test-user/${filename}`
    uploaded.push(relativePath)
    return { relativePath, storageType: 'local', publicUrl: `/uploads/${relativePath}` }
  },
  deleteAsset: async ({ relativePath }) => { deleted.push(relativePath) },
  createProject: async (payload) => {
    createPayloads.push(payload)
    const project = payload.data.projects[0].project
    if (project.id === 'will-fail') throw new Error('fixture create failure')
    return { detail: { definition: { id: project.id } }, warnings: [] }
  },
})
assert.equal(transactionResult.importedCount, 1)
assert.equal(transactionResult.detail.definition.id, 'will-succeed')
assert.deepEqual(deleted, ['canvas-import/test-user/fail.png'])
assert.equal(createPayloads[0].data.projects[0].project.nodes[0].metadata.assetUrl, '/uploads/canvas-import/test-user/fail.png')
assert.equal(createPayloads[1].data.projects[0].project.nodes[0].metadata.assetUrl, '/uploads/canvas-import/test-user/ok.png')
assert.match(transactionResult.warnings.join('\n'), /第 1 个项目导入失败/)

console.log('canvas archive cleanup regression passed')
