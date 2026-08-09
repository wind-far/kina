#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../..', import.meta.url)
const list = await readFile(new URL('src/views/generate/components/GenerateSessionList.vue', root), 'utf8')
const styles = await readFile(new URL('src/views/generate/generate.css', root), 'utf8')
const generateView = await readFile(new URL('src/views/generate/generate.vue', root), 'utf8')

assert.doesNotMatch(list, /empty-placeholder/)
assert.doesNotMatch(list, /spacerHeight|top-placeholder-fTCjHC|empty-placeholder/)
assert.match(list, /class="virtual-list-container reverse-virtual-list"/)
assert.match(list, /const handleWheel = \(event: WheelEvent\)/)
assert.match(list, /const handleTouchMove = \(event: TouchEvent\)/)
assert.match(list, /target\.scrollTop -= event\.deltaY/)
assert.match(list, /const isAtBottom = currentScrollTop <= 10/)
assert.match(list, /container\.scrollTop - delta/)
assert.doesNotMatch(styles, /\.empty-placeholder\s*\{\s*height:\s*310px/)
assert.match(styles, /\.scroll-list\s*\{[\s\S]*?padding:\s*84px 0 24px/)
assert.match(styles, /\.virtual-list-container\.reverse-virtual-list[\s\S]*?transform:\s*rotate\(180deg\)/)
assert.match(styles, /\.reverse-virtual-list[\s\S]*?\.scroll-list > \*[\s\S]*?transform:\s*rotate\(180deg\)/)
assert.match(styles, /\.record-list-container \.filter\s*\{[\s\S]*?position:\s*fixed/)
assert.match(generateView, /const getPersistedImageUrls = \(record: PersistedGenerationRecord\)/)
assert.match(generateView, /syncRecordWithPersisted\(existingRecord, record\)/)
assert.match(generateView, /\.entry-lav5_s > \.record-list-container\s*\{[\s\S]*?flex:\s*1 1 auto/)
assert.match(generateView, /\.entry-lav5_s > \.generate-history-composer\s*\{[\s\S]*?position:\s*relative/)
assert.match(styles, /\.virtual-list\s*\{[\s\S]*?scroll-padding-bottom:\s*24px/)

console.log('generate session list top spacing regression passed')
