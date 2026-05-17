<template>
  <div class="admin-filter-chips" :class="{ 'is-disabled': disabled, 'is-compact': compact }">
    <div
      v-for="group in groups"
      :key="group.key"
      class="admin-filter-chips__group"
      role="radiogroup"
      :aria-label="group.label || group.key"
    >
      <div v-if="group.label" class="admin-filter-chips__label">{{ group.label }}</div>
      <div class="admin-filter-chips__items">
        <button
          v-for="option in group.options"
          :key="`${group.key}-${option.value}`"
          class="admin-chip-button"
          :class="{ 'is-active': group.modelValue === option.value }"
          type="button"
          role="radio"
          :aria-checked="group.modelValue === option.value"
          :disabled="disabled || option.disabled"
          @click="handleSelect(group.key, group.modelValue, option.value)"
        >
          {{ option.label }}
          <span v-if="option.count !== undefined" class="admin-filter-chips__count">{{ option.count }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface AdminFilterChipOption {
  label: string
  value: string
  count?: number
  disabled?: boolean
}

export interface AdminFilterChipGroup {
  key: string
  label?: string
  modelValue: string
  options: AdminFilterChipOption[]
}

const props = withDefaults(defineProps<{
  groups: AdminFilterChipGroup[]
  disabled?: boolean
  compact?: boolean
}>(), {
  disabled: false,
  compact: false,
})

const emit = defineEmits<{
  select: [payload: { groupKey: string; value: string }]
}>()

// 统一拦截重复点击，避免每个后台页都各自写一层相同判断。
const handleSelect = (groupKey: string, currentValue: string, nextValue: string) => {
  if (props.disabled || currentValue === nextValue) {
    return
  }

  emit('select', {
    groupKey,
    value: nextValue,
  })
}
</script>

<style scoped>
.admin-filter-chips {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 12px;
}

.admin-filter-chips.is-disabled {
  opacity: 0.72;
}

.admin-filter-chips__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.admin-filter-chips__label {
  flex: 0 0 auto;
  min-width: 36px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.admin-filter-chips__items {
  display: flex;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
  gap: 8px;
}

.admin-filter-chips__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 11px;
  font-weight: 700;
}

.admin-filter-chips.is-compact {
  gap: 10px;
}

.admin-filter-chips.is-compact :deep(.admin-chip-button) {
  height: 30px;
  padding: 0 11px;
  font-size: 12px;
}
</style>
