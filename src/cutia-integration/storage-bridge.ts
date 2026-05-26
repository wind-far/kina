import {
	__replaceStorageServiceForIntegration,
	StorageService,
} from '@cutia/services/storage/service'
import { RemoteStorageAdapter } from '@cutia/services/storage/remote-storage-adapter'
import { buildApiUrl } from '@/api/http'

/**
 * Cutia StorageService 与 canana-vue 后端的桥接层。
 *
 * 在 Vue 路由的 <script setup> 顶层(早于 onMounted 中的 React mount)调用
 * ensureRemoteStorageInstalled() 一次,把 cutia 内部的全局 storageService 单例
 * 替换为注入了 RemoteStorageAdapter 的实例,从而让 cutia 内部所有 IndexedDB
 * 读写都转向 /api/video-projects/* 后端接口。
 *
 * baseUrl 走 buildApiUrl 拼,自动带上 VITE_API_BASE_URL(开发态 server 跑在
 * 5409 端口,前端在 5010,不走 vite proxy);生产同源时为空串相对路径。
 *
 * cutia 源码不感知此切换 — 所有 `import { storageService }` 都通过 ES Module
 * live binding 自动指向新实例。skipMigrations:true 跳过 runner(runner 内部
 * 硬绑 IndexedDB,远程数据 v3 起步,migration 无关)。
 */
let installed = false

export function ensureRemoteStorageInstalled() {
	if (installed) return
	__replaceStorageServiceForIntegration(
		new StorageService({
			projectsAdapter: new RemoteStorageAdapter(buildApiUrl('/api/video-projects')),
			skipMigrations: true,
		}),
	)
	installed = true
}
