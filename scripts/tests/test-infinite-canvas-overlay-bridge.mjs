#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (file) => readFile(path.join(rootDir, file), 'utf8')

const [wrapper, channelEditor] = await Promise.all([
  read('src/views/infinite-canvas-replica/InfiniteCanvasReplicaView.vue'),
  read('src-infinite-canvas/components/layout/channel-editor-drawer.tsx'),
])

assert.match(channelEditor, /type:\s*"canvasmind:overlay-state"/)
assert.match(channelEditor, /overlay:\s*"channel-editor"/)
assert.match(channelEditor, /notifyParent\(open\)/)
assert.match(channelEditor, /if \(open\) notifyParent\(false\)/)

assert.match(wrapper, /event\.data\.type === 'canvasmind:overlay-state'/)
assert.match(wrapper, /event\.data\.overlay === 'channel-editor'/)
assert.match(wrapper, /replicaOverlayOpen\.value = Boolean\(event\.data\.open\)/)
assert.match(wrapper, /v-show="!replicaOverlayOpen" class="infinite-canvas-replica__account"/)
assert.match(wrapper, /@load="handleReplicaLoad"/)

console.log('[infinite-canvas-overlay-bridge] 渠道抽屉与外层用户信息避让检查通过')
