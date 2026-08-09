#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../..', import.meta.url)
const source = await readFile(new URL('src/views/generate/generate.vue', root), 'utf8')
const sidebarSource = await readFile(new URL('src/views/generate/components/GenerateConversationSidebar.vue', root), 'utf8')

assert.match(source, /const conversationSidebarAutoCollapseDismissed = ref\(false\)/)
assert.match(source, /const shouldAutoCollapseConversationSidebar = computed\(\(\) => \{[\s\S]*?isCurrentSessionEmpty\.value && sidebarRecentSessions\.value\.length === 0/)
assert.match(source, /return !conversationSidebarAutoCollapseDismissed\.value && shouldAutoCollapseConversationSidebar\.value/)
assert.match(source, /const handleToggleConversationSidebar = \(\) => \{[\s\S]*?if \(isConversationSidebarEffectivelyCollapsed\.value\) \{[\s\S]*?conversationSidebarCollapsed\.value = false[\s\S]*?conversationSidebarAutoCollapseDismissed\.value = true/)
assert.match(source, /const loadPersistedGenerateWorkspace = async \(\) => \{[\s\S]*?await authStore\.loadSession\(\)[\s\S]*?loadPersistedGenerationSessions\(\)[\s\S]*?loadPersistedGeneratingRecords\(\)/)
assert.match(source, /onMounted\(\(\) => \{[\s\S]*?void loadPersistedGenerateWorkspace\(\)/)
assert.doesNotMatch(
  sidebarSource,
  /class="new-conversation-entry active-aic4ZS"/,
  '新对话是创建操作，不能带有会话选中态',
)
assert.match(
  sidebarSource,
  /'active-aic4ZS': activeSessionId === session\.id/,
  '最近会话仍应只根据当前会话 ID 显示选中态',
)

console.log('generate conversation sidebar toggle regression passed')
