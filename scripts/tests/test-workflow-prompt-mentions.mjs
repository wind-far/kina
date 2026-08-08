#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const component = await readFile(
  fileURLToPath(new URL('../../src/components/canvas/WorkflowPromptInput.vue', import.meta.url)),
  'utf8',
)

assert.match(component, /@input="updateMentionTrigger"/)
assert.match(component, /const updateMentionTrigger = \(event: Event\)/)
assert.match(component, /openPanel\.value = 'reference'/)
assert.match(component, /mentionTriggerRange\.value = \{[\s\S]*start:/)
assert.match(component, /const filteredAvailableReferences = computed/)
assert.match(component, /v-for="reference in filteredAvailableReferences"/)
assert.match(component, /text-indent: var\(--workflow-mention-indent, 0px\)/)
assert.match(component, /:style="\{ '--workflow-mention-indent': `\$\{mentionIndent\}px` \}"/)

console.log('[test-workflow-prompt-mentions] 文本换行与 @ 引用菜单通过')
