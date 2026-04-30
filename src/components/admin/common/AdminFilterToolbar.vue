<template>
  <div class="admin-filter-toolbar">
    <div v-if="$slots.search || $slots.actions" class="admin-filter-toolbar__top">
      <div v-if="$slots.search" class="admin-filter-toolbar__search">
        <slot name="search" />
      </div>
      <div v-if="$slots.actions" class="admin-filter-toolbar__actions">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.filters || $slots.meta" class="admin-filter-toolbar__bottom">
      <div v-if="$slots.filters" class="admin-filter-toolbar__filters">
        <slot name="filters" />
      </div>
      <div v-if="$slots.meta" class="admin-filter-toolbar__meta">
        <slot name="meta" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-filter-toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 18px;
  background: color-mix(in srgb, var(--bg-surface) 82%, var(--bg-block-secondary-default));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--bg-surface) 70%, transparent);
}

.admin-filter-toolbar__top,
.admin-filter-toolbar__bottom {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px 16px;
}

.admin-filter-toolbar__search,
.admin-filter-toolbar__filters {
  flex: 1;
  min-width: 0;
}

.admin-filter-toolbar__actions,
.admin-filter-toolbar__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .admin-filter-toolbar__top,
  .admin-filter-toolbar__bottom {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-filter-toolbar__actions,
  .admin-filter-toolbar__meta {
    justify-content: flex-start;
  }
}
</style>
