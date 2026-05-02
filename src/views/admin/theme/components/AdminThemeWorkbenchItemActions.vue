<template>
  <div class="admin-theme-workbench-item-actions">
    <button
      v-for="action in actions"
      :key="action.key"
      class="admin-theme-workbench-item-actions__button"
      :class="action.className"
      type="button"
      :disabled="action.disabled"
      :aria-label="action.label"
      :title="action.label"
      @pointerdown.stop="handlePointerDown($event, action.key)"
      @mousedown.stop="handleMouseDown($event, action.key)"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          v-for="(path, index) in actionIconPathMap[action.key]"
          :key="`${action.key}-${index}`"
          :d="path"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type WorkbenchMenuActionKey = 'edit' | 'visible' | 'delete' | 'sort'

interface ActionItem {
  key: WorkbenchMenuActionKey
  label: string
  className?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  visible?: boolean
  sortArmed?: boolean
}>(), {
  visible: true,
  sortArmed: false,
})

const emit = defineEmits<{
  action: [action: WorkbenchMenuActionKey]
  'sort-press': [event: PointerEvent]
}>()

const actions = computed<ActionItem[]>(() => [
  { key: 'edit', label: '编辑' },
  { key: 'visible', label: props.visible ? '隐藏' : '恢复显示', className: props.visible ? '' : 'is-hidden-state' },
  { key: 'delete', label: '删除', className: 'is-danger' },
  { key: 'sort', label: props.sortArmed ? '拖拽中，点击取消' : '拖拽排序', className: props.sortArmed ? 'is-drag is-drag-armed' : 'is-drag' },
])

const actionIconPathMap = computed<Record<WorkbenchMenuActionKey, string[]>>(() => ({
  edit: [
    'M12 20h9',
    'M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z',
  ],
  visible: props.visible
    ? [
        'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0Z',
        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
      ]
    : [
        'M4 4l16 16',
        'M9.9 4.24A10.72 10.72 0 0 1 12 4c5.05 0 9.27 3.11 11 8-1 2.83-3.1 5.14-5.82 6.42',
        'M6.61 6.61C4.38 8.05 2.62 9.86 1 12c1.73 4.89 5.95 8 11 8 1.77 0 3.43-.38 4.91-1.05',
        'M10.73 10.73A2.99 2.99 0 0 0 10 12a3 3 0 0 0 3 3c.47 0 .92-.11 1.31-.3',
      ],
  delete: [
    'M8 12h8',
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z',
  ],
  sort: [
    'M9 6h.01',
    'M9 12h.01',
    'M9 18h.01',
    'M15 6h.01',
    'M15 12h.01',
    'M15 18h.01',
  ],
}))

const handlePointerDown = (event: PointerEvent, action: WorkbenchMenuActionKey) => {
  if (action !== 'sort') {
    return
  }
  emit('sort-press', event)
}

const handleMouseDown = (event: MouseEvent, action: WorkbenchMenuActionKey) => {
  if (action === 'sort') {
    return
  }
  event.preventDefault()
  emit('action', action)
}
</script>

<style scoped>
.admin-theme-workbench-item-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(24, 24, 28, 0.96);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(16px);
}

.admin-theme-workbench-item-actions__button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.admin-theme-workbench-item-actions__button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.admin-theme-workbench-item-actions__button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.96);
}

.admin-theme-workbench-item-actions__button:disabled:hover {
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
}

.admin-theme-workbench-item-actions__button svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.admin-theme-workbench-item-actions__button.is-danger {
  color: #ff8c8c;
}

.admin-theme-workbench-item-actions__button.is-danger:hover {
  background: rgba(255, 107, 107, 0.14);
  color: #ffb4b4;
}

.admin-theme-workbench-item-actions__button.is-drag {
  color: rgba(255, 255, 255, 0.52);
  cursor: grab;
}

.admin-theme-workbench-item-actions__button.is-drag-armed {
  color: #c5dcff;
  background: rgba(138, 180, 255, 0.18);
  box-shadow: inset 0 0 0 1px rgba(138, 180, 255, 0.22);
}

.admin-theme-workbench-item-actions__button.is-drag:active {
  cursor: grabbing;
}

.admin-theme-workbench-item-actions__button.is-hidden-state {
  color: #8ab4ff;
  background: rgba(138, 180, 255, 0.12);
}

.admin-theme-workbench-item-actions__button.is-hidden-state:hover {
  color: #c5dcff;
  background: rgba(138, 180, 255, 0.2);
}
</style>
