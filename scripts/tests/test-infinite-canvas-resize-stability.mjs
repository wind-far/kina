#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const nodeSource = await readFile(path.join(rootDir, 'src-infinite-canvas/components/canvas/canvas-node.tsx'), 'utf8')
const projectSource = await readFile(path.join(rootDir, 'src-infinite-canvas/pages/canvas/project.tsx'), 'utf8')

// Resize events must be coalesced to one update per paint and must flush the final cursor position.
assert.match(nodeSource, /const resizeFrameRef = useRef<number \| null>\(null\)/)
assert.match(nodeSource, /window\.requestAnimationFrame\(\(\) =>/)
assert.match(nodeSource, /const flushPendingResize = useCallback\(\(\) =>/)
assert.match(nodeSource, /flushPendingResize\(\);\n\s*onResizeEnd\(data\.id\);/)
assert.match(nodeSource, /window\.cancelAnimationFrame\(resizeFrameRef\.current\)/)

// Repeated browser resize notifications and repeated dimensions must preserve the existing state object.
assert.match(projectSource, /current\.width === nextSize\.width && current\.height === nextSize\.height \? current : nextSize/)
assert.match(projectSource, /current\.width === width && current\.height === height && current\.position\.x === nextPosition\.x && current\.position\.y === nextPosition\.y\) return prev/)
assert.match(projectSource, /setIsNodeResizing\(\(current\) => current \? false : current\)/)

console.log('infinite canvas resize stability regression passed')
