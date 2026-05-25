import { useState } from 'react'

export interface HelloReactProps {
	from: string
	onExit?: () => void
}

export function HelloReact({ from, onExit }: HelloReactProps) {
	const [count, setCount] = useState(0)

	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-900 p-8 text-white">
			<h1 className="text-3xl font-bold">Hello React from Vue 🚀</h1>
			<p className="text-slate-300">
				调用来源：<span className="font-mono text-emerald-400">{from}</span>
			</p>
			<div className="flex items-center gap-3 rounded-lg bg-slate-800 px-6 py-4">
				<span>计数：</span>
				<span className="font-mono text-2xl text-emerald-400">{count}</span>
				<button
					type="button"
					className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-emerald-400"
					onClick={() => setCount((c) => c + 1)}
				>
					+1
				</button>
				<button
					type="button"
					className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-600"
					onClick={() => setCount(0)}
				>
					重置
				</button>
			</div>
			{onExit && (
				<button
					type="button"
					className="mt-2 text-sm text-slate-400 underline hover:text-slate-200"
					onClick={onExit}
				>
					返回 Vue 主页
				</button>
			)}
			<p className="mt-4 max-w-md text-center text-xs text-slate-500">
				验收：✅ React 18 createRoot 挂载｜✅ Tailwind 生效｜
				✅ 点击事件响应｜✅ HMR 修改文本不刷新页面｜✅ 切换路由正常卸载
			</p>
		</div>
	)
}
