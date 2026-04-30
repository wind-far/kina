<template>
  <AdminPageContainer title="用户管理" description="查看用户列表、账号状态与资源沉淀情况，并直接切换后台管理员角色。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" @click="loadUsers" :disabled="loading || updatingId !== ''">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
    </template>

    <div class="admin-grid admin-grid--stats">
      <AdminStatCard label="当前结果" :value="users.length" hint="当前筛选结果中的用户数量" />
      <AdminStatCard label="管理员" :value="adminCount" hint="当前筛选结果中的管理员数量" />
      <AdminStatCard label="普通用户" :value="userCount" hint="当前筛选结果中的普通用户数量" />
      <AdminStatCard label="已激活" :value="activeCount" hint="当前筛选结果中的激活用户数量" />
    </div>

    <div class="admin-filter-bar">
      <AdminFilterChips :groups="filterChipGroups" :disabled="loading" @select="handleChipSelect" />
      <div style="display: flex; gap: 10px; flex-wrap: wrap; width: 100%;">
        <input
          v-model.trim="filters.keyword"
          class="admin-input"
          type="text"
          placeholder="搜索昵称、邮箱、手机号或用户 ID"
          @keydown.enter="handleSearch"
        >
        <button class="admin-inline-button" type="button" :disabled="loading" @click="handleSearch">搜索</button>
        <button class="admin-inline-button" type="button" :disabled="loading" @click="resetFilters">重置</button>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">用户列表</h4>
          <div class="admin-card__desc">支持按角色、状态与关键词筛选，并直接把账号切换为管理员或普通用户。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div v-if="loading" class="admin-empty">正在加载用户列表...</div>
        <div v-else-if="users.length === 0" class="admin-empty">当前筛选条件下还没有用户数据。</div>
        <div v-else class="admin-user-list">
          <div v-for="user in users" :key="user.id" class="admin-user-card">
            <div class="admin-user-card__avatar">
              <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.name || '用户头像'" class="admin-user-card__avatar-image">
              <div v-else class="admin-user-card__avatar-fallback">{{ getUserInitial(user.name || user.maskedEmail || user.maskedPhone || 'U') }}</div>
            </div>

            <div class="admin-user-card__body">
              <div class="admin-user-card__head">
                <div>
                  <div class="admin-user-card__title">{{ user.name || '未命名用户' }}</div>
                  <div class="admin-user-card__meta">
                    {{ user.maskedEmail || user.maskedPhone || '未绑定邮箱/手机号' }}
                  </div>
                </div>
                <div class="admin-user-card__tags">
                  <span class="admin-status" :class="user.role === 'ADMIN' ? 'admin-status--success' : 'admin-status--warning'">
                    {{ user.role === 'ADMIN' ? '管理员' : '普通用户' }}
                  </span>
                  <span class="admin-chip">状态：{{ getStatusLabel(user.status) }}</span>
                </div>
              </div>

              <div class="admin-user-card__stats">
                <span>资源数：{{ user.assetCount }}</span>
                <span>生成记录：{{ user.generationRecordCount }}</span>
                <span>创建时间：{{ formatDate(user.createdAt) }}</span>
              </div>

              <div class="admin-user-card__footer">
                <div class="admin-user-card__meta">用户 ID：{{ user.id }}</div>
                <div class="admin-list-item__actions">
                  <button
                    v-if="user.role !== 'ADMIN'"
                    class="admin-inline-button"
                    type="button"
                    :disabled="updatingId === user.id"
                    @click="handleUpdateRole(user.id, 'ADMIN')"
                  >
                    {{ updatingId === user.id ? '更新中...' : '设为管理员' }}
                  </button>
                  <button
                    v-else
                    class="admin-inline-button admin-inline-button--danger"
                    type="button"
                    :disabled="updatingId === user.id"
                    @click="handleUpdateRole(user.id, 'USER')"
                  >
                    {{ updatingId === user.id ? '更新中...' : '设为普通用户' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AdminFilterChips, { type AdminFilterChipGroup } from '@/components/admin/common/AdminFilterChips.vue'
import AdminStatCard from '@/components/admin/common/AdminStatCard.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { listAdminUsers, updateAdminUserRole, type AdminUserItem, type ListAdminUsersOptions } from '@/api/admin-users'

const loading = ref(false)
const updatingId = ref('')
const users = ref<AdminUserItem[]>([])

const filters = reactive<ListAdminUsersOptions>({
  keyword: '',
  role: 'ALL',
  status: 'ALL',
})

const roleOptions: Array<{ label: string; value: 'ALL' | 'USER' | 'ADMIN' }> = [
  { label: '全部角色', value: 'ALL' },
  { label: '管理员', value: 'ADMIN' },
  { label: '普通用户', value: 'USER' },
]

const statusOptions: Array<{ label: string; value: 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED' }> = [
  { label: '全部状态', value: 'ALL' },
  { label: '匿名', value: 'ANONYMOUS' },
  { label: '已激活', value: 'ACTIVE' },
  { label: '已禁用', value: 'DISABLED' },
]

const filterChipGroups = computed((): AdminFilterChipGroup[] => [
  {
    key: 'role',
    label: '角色',
    modelValue: filters.role ?? 'ALL',
    options: roleOptions,
  },
  {
    key: 'status',
    label: '状态',
    modelValue: filters.status ?? 'ALL',
    options: statusOptions,
  },
])

const adminCount = computed(() => users.value.filter(user => user.role === 'ADMIN').length)
const userCount = computed(() => users.value.filter(user => user.role !== 'ADMIN').length)
const activeCount = computed(() => users.value.filter(user => user.status === 'ACTIVE').length)

const loadUsers = async () => {
  loading.value = true
  try {
    users.value = await listAdminUsers(filters)
  } finally {
    loading.value = false
  }
}

const handleUpdateRole = async (id: string, role: 'USER' | 'ADMIN') => {
  updatingId.value = id
  try {
    await updateAdminUserRole(id, role)
    await loadUsers()
  } finally {
    updatingId.value = ''
  }
}

const handleSearch = () => {
  void loadUsers()
}

const setRole = (role: 'ALL' | 'USER' | 'ADMIN') => {
  if (filters.role === role) {
    return
  }

  filters.role = role
  void loadUsers()
}

const setStatus = (status: 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED') => {
  if (filters.status === status) {
    return
  }

  filters.status = status
  void loadUsers()
}

const handleChipSelect = (payload: { groupKey: string; value: string }) => {
  if (payload.groupKey === 'role') {
    setRole(payload.value as 'ALL' | 'USER' | 'ADMIN')
    return
  }

  if (payload.groupKey === 'status') {
    setStatus(payload.value as 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED')
  }
}

const resetFilters = () => {
  filters.keyword = ''
  filters.role = 'ALL'
  filters.status = 'ALL'
  void loadUsers()
}

const getUserInitial = (value: string) => {
  return String(value || 'U').trim().slice(0, 1).toUpperCase() || 'U'
}

// 将用户状态统一映射成中文文案，避免模板里散落判断逻辑。
const getStatusLabel = (status: string) => {
  if (status === 'ACTIVE') {
    return '已激活'
  }

  if (status === 'DISABLED') {
    return '已禁用'
  }

  if (status === 'ANONYMOUS') {
    return '匿名'
  }

  return status || '未知'
}

const formatDate = (value?: string) => {
  if (!value) {
    return '未知时间'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  void loadUsers()
})
</script>
