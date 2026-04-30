<template>
  <div class="admin-filter-chips" :class="{ 'is-disabled': disabled }">
    <div
      v-for="group in groups"
      :key="group.key"
      class="admin-filter-chips__group"
    >
      <div v-if="group.label" class="admin-filter-chips__label">{{ group.label }}</div>
      <div class="admin-filter-chips__items">
        <button
          v-for="option in group.options"
          :key="`${group.key}-${option.value}`"
          class="admin-chip-button"
          :class="{ 'is-active': group.modelValue === option.value }"
          type="button"
          :disabled="disabled"
          @click="handleSelect(group.key, group.modelValue, option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface AdminFilterChipOption {
  label: string
  value: string
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
}>(), {
  disabled: false,
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
  flex-wrap: wrap;
  gap: 12px 20px;
}

.admin-filter-chips.is-disabled {
  opacity: 0.72;
}

.admin-filter-chips__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.admin-filter-chips__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.admin-filter-chips__items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
