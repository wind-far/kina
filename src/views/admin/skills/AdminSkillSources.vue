<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Refresh, Link } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { listAdminSkillSources, syncMiniMaxH3SkillSources, type AdminSkillSourcePackage } from '@/api/admin-skill-sources'

const loading = ref(false)
const syncing = ref(false)
const sources = ref<AdminSkillSourcePackage[]>([])

const loadSources = async () => {
  loading.value = true
  try {
    sources.value = await listAdminSkillSources()
  } catch (error: any) {
    ElMessage.error(error?.message || '读取 Skill 来源失败')
  } finally {
    loading.value = false
  }
}

const syncH3 = async () => {
  syncing.value = true
  try {
    await syncMiniMaxH3SkillSources()
    await loadSources()
  } catch (error: any) {
    ElMessage.error(error?.message || '同步 MiniMax H3 Skill 失败')
  } finally {
    syncing.value = false
  }
}

const shortHash = (value: string | null) => value ? `${value.slice(0, 12)}…` : '未冻结'
const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })

onMounted(() => { void loadSources() })
</script>

<template>
  <main class="admin-skill-sources">
    <header class="admin-skill-sources__header">
      <div>
        <p class="admin-skill-sources__eyebrow">TRUSTED SKILL REGISTRY</p>
        <h2>Skill 来源管理</h2>
        <p>外部 Skill 文档只在管理员同步后冻结入库，运行时不会从远程仓库直接读取。</p>
      </div>
      <div class="admin-skill-sources__actions">
        <button class="source-button source-button--secondary" :disabled="loading || syncing" @click="loadSources">
          <el-icon><Refresh /></el-icon> 刷新
        </button>
        <button class="source-button" :disabled="syncing" @click="syncH3">
          <el-icon><Refresh /></el-icon> {{ syncing ? '正在同步 H3…' : '同步 MiniMax H3' }}
        </button>
      </div>
    </header>

    <section class="admin-skill-sources__notice">
      同步会先固定 GitHub 提交 SHA，再下载官方清单中的 Skill 文档与参考资料，并记录每个文件和整个来源包的 SHA-256。
    </section>

    <section v-loading="loading" class="source-list">
      <article v-for="source in sources" :key="source.id" class="source-card">
        <div class="source-card__top">
          <div>
            <h3>{{ source.name }}</h3>
            <code>{{ source.packageKey }}</code>
          </div>
          <span class="source-card__status" :class="source.isEnabled ? 'is-enabled' : 'is-disabled'">
            {{ source.isEnabled ? '已启用' : '已停用' }}
          </span>
        </div>
        <dl>
          <div><dt>冻结文档 / Skill</dt><dd>{{ source.artifactCount }} / {{ source.skillCount }}</dd></div>
          <div><dt>来源版本</dt><dd>{{ source.sourceRevision ? shortHash(source.sourceRevision) : '尚未同步' }}</dd></div>
          <div><dt>内容哈希</dt><dd>{{ shortHash(source.integritySha256) }}</dd></div>
          <div><dt>最近更新</dt><dd>{{ formatDate(source.updatedAt) }}</dd></div>
        </dl>
        <div class="source-card__links">
          <a v-if="source.repositoryUrl" :href="source.repositoryUrl" target="_blank" rel="noreferrer"><el-icon><Link /></el-icon> 源仓库</a>
          <a v-if="source.licenseUrl" :href="source.licenseUrl" target="_blank" rel="noreferrer"><el-icon><Link /></el-icon> 许可证</a>
          <span v-if="source.termsVersion">条款版本：{{ source.termsVersion }}</span>
        </div>
      </article>
      <div v-if="!loading && !sources.length" class="source-list__empty">暂无已登记的受信 Skill 来源。</div>
    </section>
  </main>
</template>

<style scoped>
.admin-skill-sources { padding: 28px; color: #20293a; }
.admin-skill-sources__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.admin-skill-sources__header h2 { margin: 3px 0 8px; font-size: 26px; }
.admin-skill-sources__header p { margin: 0; color: #687386; }
.admin-skill-sources__eyebrow { color: #7267ed !important; font-size: 11px; font-weight: 700; letter-spacing: .12em; }
.admin-skill-sources__actions { display: flex; gap: 10px; }
.source-button { border: 0; border-radius: 9px; padding: 10px 14px; color: #fff; background: #635bdb; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; font-weight: 600; }
.source-button:disabled { opacity: .55; cursor: not-allowed; }
.source-button--secondary { color: #434e60; background: #edf0f5; }
.admin-skill-sources__notice { margin-bottom: 16px; padding: 12px 14px; border-radius: 10px; color: #5a527e; background: #f3f0ff; border: 1px solid #dfd9ff; font-size: 13px; }
.source-list { display: grid; gap: 14px; }
.source-card { padding: 18px; border: 1px solid #e5e8ef; border-radius: 14px; background: #fff; box-shadow: 0 3px 12px rgba(36, 43, 58, .04); }
.source-card__top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.source-card h3 { margin: 0 0 6px; font-size: 17px; }
.source-card code { color: #687386; font-size: 12px; }
.source-card__status { border-radius: 99px; padding: 4px 8px; font-size: 12px; }
.source-card__status.is-enabled { color: #147348; background: #e7f7ef; }
.source-card__status.is-disabled { color: #9d3030; background: #ffeded; }
.source-card dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0 14px; }
.source-card dt { color: #8993a5; font-size: 12px; margin-bottom: 4px; }.source-card dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.source-card__links { display: flex; flex-wrap: wrap; gap: 14px; color: #687386; font-size: 12px; }.source-card__links a { color: #635bdb; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
.source-list__empty { padding: 42px; text-align: center; color: #8993a5; border: 1px dashed #dbe0e9; border-radius: 12px; }
@media (max-width: 760px) { .admin-skill-sources { padding: 18px; }.admin-skill-sources__header { display: block; }.admin-skill-sources__actions { margin-top: 14px; }.source-card dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
