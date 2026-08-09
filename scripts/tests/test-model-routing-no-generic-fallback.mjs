#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const workflowSource = fs.readFileSync(path.join(rootDir, 'src/views/workflow/index.vue'), 'utf8')
const workspaceSource = fs.readFileSync(path.join(rootDir, 'server/generation-tasks/upstream-helpers.ts'), 'utf8')

assert.match(workflowSource, /const workflowPromptImageModel = ref\(''\)/)
assert.doesNotMatch(workflowSource, /\{ key: 'gpt-image-2', label: 'gpt-image-2'/)
assert.match(workflowSource, /const nextImageModel = getDefaultImageModelKey\(\) \|\| workflowPromptImageModels\.value\[0\]\?\.key \|\| ''/)
assert.match(workspaceSource, /catalog\.models\.image\.find\(item => item\.providerCode === 'env-image-provider'\)/)
assert.match(workspaceSource, /catalog\.models\.image\.find\(item => item\.providerCode !== 'env-image-provider'\)/)
assert.match(workspaceSource, /或在 \.env 中配置 IMAGE_PROVIDER_\*/)
assert.doesNotMatch(workspaceSource, /const imageModel = catalog\.models\.image\[0\]/)

console.log('model routing generic fallback regression passed')
