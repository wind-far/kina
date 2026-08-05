import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useFreeCanvasDrag } from '../../src/composables/useFreeCanvasDrag.ts'
import {
  getInfiniteCanvasBounds,
  getLegacyCanvasPosition,
  normalizeInfiniteCanvasImages,
} from '../../src/shared/infinite-canvas-layout.ts'
import {
  buildInfiniteCanvasVersionPayload,
  normalizeInfiniteCanvasProjectSnapshot,
} from '../../src/composables/useInfiniteCanvasProject.ts'

const legacyPosition = getLegacyCanvasPosition(5)
assert.deepEqual(legacyPosition, { x: 2016, y: 2592 })

const normalized = normalizeInfiniteCanvasImages([
  { id: 1, src: '/a.png', w: 300, h: 200, index: 5 },
  { id: 'b', src: '/b.png', w: 100, h: 80, x: -40, y: 25, zIndex: 9 },
  { id: 'invalid-without-source' },
])
assert.equal(normalized.length, 2)
assert.deepEqual(
  { x: normalized[0].x, y: normalized[0].y, zIndex: normalized[0].zIndex },
  { ...legacyPosition, zIndex: 0 },
)
assert.deepEqual(
  { x: normalized[1].x, y: normalized[1].y, zIndex: normalized[1].zIndex },
  { x: -40, y: 25, zIndex: 9 },
)

assert.deepEqual(getInfiniteCanvasBounds(normalized), {
  minX: -40,
  minY: 25,
  maxX: 2316,
  maxY: 2792,
  width: 2356,
  height: 2767,
  centerX: 1138,
  centerY: 1408.5,
})

const draggableImages = ref([{ ...normalized[1] }])
const drag = useFreeCanvasDrag(draggableImages)
drag.startDrag('b', 100, 100, { x: 20, y: 30, scale: 2 })
assert.equal(drag.hasMovedBeyondThreshold(103, 104), false)
assert.equal(drag.hasMovedBeyondThreshold(107, 104), true)
drag.updateDrag(140, 120, { x: 20, y: 30, scale: 2 })
assert.deepEqual(drag.draggingPosition.value, { x: -20, y: 100 })
assert.deepEqual(drag.endDrag('b'), { oldX: -40, oldY: 25, newX: -20, newY: 35 })
assert.deepEqual(
  { x: draggableImages.value[0].x, y: draggableImages.value[0].y },
  { x: -20, y: 35 },
)

const detail = (schemaVersion, data, position = { x: 0, y: 0 }) => ({
  definition: { currentVersion: null, latestVersion: null },
  versions: [{
    definitionJson: { schemaVersion },
    nodesJson: [{ id: 'node-1', position, data }],
    viewportJson: { x: 11, y: 12, zoom: 0.75 },
  }],
})

const legacySnapshot = normalizeInfiniteCanvasProjectSnapshot(detail(1, {
  src: '/legacy.png', w: 120, h: 90, index: 1,
}))
assert.deepEqual(
  { x: legacySnapshot.images[0].x, y: legacySnapshot.images[0].y },
  getLegacyCanvasPosition(1),
)

const freeformSnapshot = normalizeInfiniteCanvasProjectSnapshot(detail(2, {
  src: '/v2.png', w: 120, h: 90, zIndex: 3,
}, { x: -123, y: 456 }))
assert.deepEqual(
  { x: freeformSnapshot.images[0].x, y: freeformSnapshot.images[0].y },
  { x: -123, y: 456 },
)

const payload = buildInfiniteCanvasVersionPayload(freeformSnapshot)
assert.equal(payload.definitionJson.schemaVersion, 2)
assert.deepEqual(payload.nodesJson[0].position, { x: -123, y: 456 })
assert.equal(payload.runtimeConfigJson.layout, 'freeform')

console.log('infinite canvas freeform regression passed')
