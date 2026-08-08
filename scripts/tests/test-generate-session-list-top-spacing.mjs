#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../..', import.meta.url)
const list = await readFile(new URL('src/views/generate/components/GenerateSessionList.vue', root), 'utf8')
const styles = await readFile(new URL('src/views/generate/generate.css', root), 'utf8')
const generateView = await readFile(new URL('src/views/generate/generate.vue', root), 'utf8')

assert.doesNotMatch(list, /empty-placeholder/)
assert.doesNotMatch(list, /virtual-list-rotate|spacerHeight|handleWheel|handleTouchMove/)
assert.doesNotMatch(styles, /\.empty-placeholder\s*\{\s*height:\s*310px/)
assert.match(styles, /\.scroll-list\s*\{[\s\S]*?padding:\s*84px 0 24px/)
assert.match(styles, /\.record-list-container \.filter\s*\{[\s\S]*?position:\s*fixed/)
assert.match(generateView, /const getPersistedImageUrls = \(record: PersistedGenerationRecord\)/)
assert.match(generateView, /syncRecordWithPersisted\(existingRecord, record\)/)

console.log('generate session list top spacing regression passed')
