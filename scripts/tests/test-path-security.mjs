import assert from 'node:assert/strict'
import path from 'node:path'
import { isPathInsideDirectory } from '../../server/shared/path-security.ts'

const root = path.resolve('/tmp/canvasmind/uploads')

assert.equal(isPathInsideDirectory(root, path.join(root, 'images/example.png')), true)
assert.equal(isPathInsideDirectory(root, root), true)
assert.equal(isPathInsideDirectory(root, path.resolve(root, '../uploads-other/secret.txt')), false)
assert.equal(isPathInsideDirectory(root, path.resolve(root, '../secret.txt')), false)

console.log('path security regression passed')
