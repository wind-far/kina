#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (file) => readFile(path.join(rootDir, file), 'utf8')

const [accountPage, accountModal, configPage, configPanel, userLayout] = await Promise.all([
  read('src/views/account/AccountManagement.vue'),
  read('src/components/account/UserAppConfigModal.vue'),
  read('src-infinite-canvas/pages/config/index.tsx'),
  read('src-infinite-canvas/components/layout/app-config-modal.tsx'),
  read('src-infinite-canvas/layouts/user-layout.tsx'),
])

assert.match(accountPage, /<UserAppConfigModal v-model="userConfigOpen"/)
assert.match(accountPage, /@click="userConfigOpen = true"/)
assert.doesNotMatch(accountPage, /<UserVideoProviderConfig/)

assert.match(accountModal, /infinite-canvas\.html#\/config\?embedded=account/)
assert.match(accountModal, /canvasmind:config-close/)
assert.match(accountModal, /canvasmind:theme/)

assert.match(userLayout, /new URLSearchParams\(search\)\.has\("embedded"\)/)
assert.match(configPage, /<AppConfigPanel showDoneButton=\{embedded\}/)
assert.match(configPage, /canvasmind:config-close/)
assert.match(configPanel, /onDone\?: \(\) => void/)
assert.match(configPanel, /onDone\?\.\(\)/)
assert.match(configPanel, /const effectiveConfig = useEffectiveConfig\(\)/)
assert.match(configPanel, /effectiveConfig\.channels\.map/)
assert.match(configPanel, /isCanvasMindRuntimeChannel\(channel\)/)
assert.match(configPanel, /<ModelPicker config=\{effectiveConfig\} value=\{effectiveConfig\[group\.modelKey\]\}/)

console.log('[account-config] 个人中心已复用统一配置面板')
