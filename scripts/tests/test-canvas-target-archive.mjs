import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import {
  applyTargetCanvasAssetUrls,
  extractTargetCanvasArchiveEntries,
  parseTargetCanvasArchive,
} from '../../server/canvas-projects/target-archive.ts'
import { normalizeCanvasImport } from '../../src/shared/canvas-snapshot.ts'

const buildZip = (items) => {
  const locals = []
  const centrals = []
  let offset = 0
  for (const item of items) {
    const name = Buffer.from(item.name)
    const source = Buffer.from(item.content)
    const compressed = item.deflate ? deflateRawSync(source) : source
    const method = item.deflate ? 8 : 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(source.length, 22)
    local.writeUInt16LE(name.length, 26)
    locals.push(local, name, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(source.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)
    offset += local.length + name.length + compressed.length
  }
  const localBytes = Buffer.concat(locals)
  const centralBytes = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(items.length, 8)
  end.writeUInt16LE(items.length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(localBytes.length, 16)
  return Buffer.concat([localBytes, centralBytes, end])
}

const projectExport = {
  app: 'infinite-canvas',
  version: 3,
  projects: [{
    project: {
      id: 'target-project',
      title: 'ZIP 导入项目',
      nodes: [{
        id: 'hero', type: 'image', title: '主视觉', position: { x: 10, y: 20 }, width: 400, height: 300,
        metadata: { storageKey: 'image:hero', mimeType: 'image/png' },
      }],
      connections: [], viewport: { x: 3, y: 4, k: 1 }, backgroundMode: 'dots',
    },
    files: [{ storageKey: 'image:hero', path: 'projects/target-project/files/image_hero.png', mimeType: 'image/png', bytes: 4 }],
  }],
}

const archive = buildZip([
  { name: 'projects.json', content: JSON.stringify(projectExport), deflate: true },
  { name: 'projects/target-project/files/image_hero.png', content: Buffer.from([137, 80, 78, 71]) },
])
const entries = extractTargetCanvasArchiveEntries(archive)
assert.equal(entries.get('projects.json')?.toString().includes('ZIP 导入项目'), true)
assert.deepEqual(entries.get('projects/target-project/files/image_hero.png'), Buffer.from([137, 80, 78, 71]))

const parsed = parseTargetCanvasArchive(archive)
assert.equal(parsed.assets.length, 1)
assert.equal(parsed.assets[0].storageKey, 'image:hero')
const rewritten = applyTargetCanvasAssetUrls(parsed.data, new Map([['image:hero', '/uploads/canvas-import/hero.png']]))
const snapshot = normalizeCanvasImport(rewritten).snapshot
assert.equal(snapshot.nodes[0].data.url, '/uploads/canvas-import/hero.png')

assert.throws(
  () => extractTargetCanvasArchiveEntries(buildZip([{ name: '../projects.json', content: '{}' }])),
  /不安全的文件路径/,
)

console.log('canvas target archive regression passed')
