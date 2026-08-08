#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  clampCanvasScale,
  createCanvasStorageKey,
  normalizeCanvasTitle,
  resolveCanvasReturnTo,
} from '../../src/views/canana/canvas-reference-state.ts'

assert.equal(clampCanvasScale(0), 0.1)
assert.equal(clampCanvasScale(0.8), 0.8)
assert.equal(clampCanvasScale(4), 2)
assert.equal(clampCanvasScale(Number.NaN, 0.35), 0.35)

assert.equal(createCanvasStorageKey(' project-01 '), 'canvas-reference:project-01')
assert.equal(createCanvasStorageKey(''), 'canvas-reference:local')
assert.equal(createCanvasStorageKey(undefined), 'canvas-reference:local')

assert.equal(normalizeCanvasTitle(' 画布项目 '), '画布项目')
assert.equal(normalizeCanvasTitle('   '), '未命名项目')

assert.equal(resolveCanvasReturnTo('/agentic-assets-canvas', '/canvas'), '/agentic-assets-canvas')
assert.equal(resolveCanvasReturnTo('//example.com/path', '/canvas'), null)
assert.equal(resolveCanvasReturnTo('https://example.com', '/canvas'), null)
assert.equal(resolveCanvasReturnTo('/canvas', '/canvas'), null)
assert.equal(resolveCanvasReturnTo('', '/canvas'), null)

console.log('[test-canvas-reference-state] 全部通过')
