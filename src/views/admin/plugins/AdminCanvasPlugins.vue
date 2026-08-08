<template>
  <AdminPageContainer title="画布插件" description="发布经过校验的插件镜像。客户端只会加载 CanvasMind 托管版本，不会直接执行源站内容。">
    <section class="admin-plugin-notice">
      源包仅允许来自 <code>CANVAS_PLUGIN_REGISTRY_HOSTS</code> 中配置的 HTTPS 域名；服务端会限制大小、校验 SHA-256 后再写入当前存储配置。
    </section>

    <div class="admin-section-head">
      <div><div class="admin-section-head__title">受信注册表</div><div class="admin-section-head__desc">{{ plugins.length }} 个插件，发布同版本会替换镜像并回收旧资源。</div></div>
      <div class="admin-plugin-actions"><button class="admin-button admin-button--secondary" :disabled="loading || submitting" @click="load">{{ loading ? '刷新中...' : '刷新' }}</button><button class="admin-button admin-button--primary" :disabled="submitting" @click="openCreate">发布插件</button></div>
    </div>

    <div v-if="loading" class="admin-empty">正在读取插件注册表…</div>
    <div v-else-if="!plugins.length" class="admin-empty">暂无已发布插件。</div>
    <div v-else class="admin-plugin-grid">
      <article v-for="plugin in plugins" :key="plugin.id" class="admin-plugin-card">
        <div class="admin-plugin-card__top"><div><strong>{{ plugin.name }}</strong><code>{{ plugin.slug }}</code></div><span class="admin-status" :class="plugin.isEnabled ? 'admin-status--success' : 'admin-status--warning'">{{ plugin.isEnabled ? '可安装' : '已停用' }}</span></div>
        <p>{{ plugin.description || '暂无说明' }}</p>
        <div class="admin-plugin-card__capabilities"><span v-for="capability in capabilitiesOf(plugin)" :key="capability" class="admin-chip">{{ capability }}</span></div>
        <details class="admin-plugin-card__releases"><summary>版本 {{ plugin.releases.length }}</summary><div v-for="release in plugin.releases" :key="release.id" class="admin-plugin-release"><strong>v{{ release.version }}</strong><span :class="release.isMirrored ? 'admin-status admin-status--success' : 'admin-status admin-status--warning'">{{ release.isMirrored ? '镜像已验证' : '未镜像' }}</span><code>{{ shortHash(release.integritySha256) }}</code><a :href="release.sourcePackageUrl" target="_blank" rel="noreferrer">源包</a></div></details>
      </article>
    </div>
  </AdminPageContainer>

  <div v-if="dialogVisible" class="admin-dialog-mask" @click="closeDialog"><div class="admin-dialog admin-dialog--plugin" @click.stop>
    <div class="admin-dialog__header"><div><h3 class="admin-dialog__title">发布受信插件</h3><div class="admin-dialog__desc">填写源 HTML 入口和它的 SHA-256；发布后会由服务端下载、校验、镜像。</div></div><button class="admin-dialog__close" type="button" @click="closeDialog">×</button></div>
    <form class="admin-form admin-dialog__body" @submit.prevent="submit">
      <div class="admin-form__grid">
        <div class="admin-form__field"><label class="admin-form__label">名称</label><input v-model.trim="form.name" class="admin-input" required maxlength="100" placeholder="例如：镜头标注" /></div>
        <div class="admin-form__field"><label class="admin-form__label">Slug</label><input v-model.trim="form.slug" class="admin-input" required maxlength="100" placeholder="例如：shot-labeler" /></div>
        <div class="admin-form__field"><label class="admin-form__label">版本</label><input v-model.trim="form.version" class="admin-input" required maxlength="50" placeholder="例如：1.0.0" /></div>
        <div class="admin-form__field"><label class="admin-form__label">入口（manifest.entry）</label><input v-model.trim="form.entry" class="admin-input" required maxlength="500" placeholder="例如：/plugin.html" /></div>
        <div class="admin-form__field admin-form__field--full"><label class="admin-form__label">源包 HTTPS 地址</label><input v-model.trim="form.packageUrl" class="admin-input" required type="url" placeholder="https://registry.example.com/plugins/shot-labeler.html" /></div>
        <div class="admin-form__field admin-form__field--full"><label class="admin-form__label">SHA-256</label><input v-model.trim="form.integritySha256" class="admin-input" required pattern="[a-fA-F0-9]{64}" placeholder="64 位十六进制哈希" /></div>
        <div class="admin-form__field admin-form__field--full"><label class="admin-form__label">能力</label><div class="admin-plugin-capability-list"><label v-for="capability in capabilities" :key="capability" class="admin-switch-row"><input v-model="form.capabilities" type="checkbox" :value="capability" /><span>{{ capability }}</span></label></div></div>
        <div class="admin-form__field admin-form__field--full"><label class="admin-form__label">说明</label><textarea v-model.trim="form.description" class="admin-textarea" maxlength="255" placeholder="插件用途、审核说明"></textarea></div>
      </div>
      <div class="admin-form__footer"><button class="admin-button admin-button--secondary" type="button" :disabled="submitting" @click="closeDialog">取消</button><button class="admin-button admin-button--primary" type="submit" :disabled="submitting">{{ submitting ? '校验并镜像中...' : '发布受信版本' }}</button></div>
    </form>
  </div></div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { listAdminCanvasPlugins, publishCanvasPlugin, type AdminCanvasPlugin } from '@/api/canvas-plugins'

const plugins = ref<AdminCanvasPlugin[]>([])
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const capabilities = ['canvas.read', 'canvas.propose', 'nodes', 'inspector', 'toolbar', 'serialization', 'migration', 'generation']
const emptyForm = () => ({ name: '', slug: '', description: '', version: '', packageUrl: '', integritySha256: '', entry: '/plugin.html', capabilities: [] as string[] })
const form = reactive(emptyForm())
const capabilitiesOf = (plugin: AdminCanvasPlugin) => Array.isArray(plugin.manifest?.capabilities) ? plugin.manifest.capabilities.map(String) : []
const shortHash = (value: string) => value ? `${value.slice(0, 12)}…` : '无哈希'
const load = async () => { loading.value = true; try { plugins.value = await listAdminCanvasPlugins() } catch (error: any) { ElMessage.error(error?.message || '读取插件注册表失败') } finally { loading.value = false } }
const openCreate = () => { Object.assign(form, emptyForm()); dialogVisible.value = true }
const closeDialog = () => { if (!submitting.value) dialogVisible.value = false }
const submit = async () => { submitting.value = true; try { await publishCanvasPlugin({ slug: form.slug, name: form.name, description: form.description, version: form.version, packageUrl: form.packageUrl, integritySha256: form.integritySha256, manifest: { entry: form.entry, capabilities: [...form.capabilities] } }); ElMessage.success('插件已验证并镜像发布'); dialogVisible.value = false; await load() } catch (error: any) { ElMessage.error(error?.message || '插件发布失败') } finally { submitting.value = false } }
onMounted(() => { void load() })
</script>

<style scoped>
.admin-plugin-notice { margin-bottom: 18px; padding: 13px 15px; border: 1px solid #dcd5ff; border-radius: 10px; color: #554d80; background: #f5f2ff; font-size: 13px; line-height: 1.6; }.admin-plugin-actions { display:flex; gap:10px; }.admin-plugin-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }.admin-plugin-card { padding:18px; border:1px solid #e3e7ee; border-radius:14px; background:#fff; }.admin-plugin-card__top { display:flex; justify-content:space-between; gap:10px; }.admin-plugin-card strong,.admin-plugin-card code { display:block; }.admin-plugin-card strong { font-size:16px; }.admin-plugin-card code { margin-top:4px; color:#7e8798; font-size:12px; }.admin-plugin-card p { min-height:38px; color:#647084; font-size:13px; line-height:1.5; }.admin-plugin-card__capabilities { display:flex; flex-wrap:wrap; gap:6px; }.admin-plugin-card__releases { margin-top:14px; color:#596477; font-size:13px; }.admin-plugin-card__releases summary { cursor:pointer; }.admin-plugin-release { display:grid; grid-template-columns:auto auto 1fr auto; gap:8px; align-items:center; margin-top:9px; }.admin-plugin-release code { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.admin-plugin-release a { color:#635bdb; }.admin-dialog--plugin { width:min(720px,calc(100vw - 32px)); }.admin-plugin-capability-list { display:flex; flex-wrap:wrap; gap:8px 16px; }.admin-plugin-capability-list .admin-switch-row { margin:0; }
</style>
