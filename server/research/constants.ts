import type { ResearchStage } from '../../src/shared/research/research-types'

export const RESEARCH_STAGE_LABELS: Record<ResearchStage, string> = {
  intake: '研究任务解析中',
  bootstrap_planning: '初始研究框架构建中',
  parallel_search: '首轮并行搜索规划中',
  initial_analysis: '首轮结果分析中',
  disambiguation: '主体歧义识别中',
  gap_detection: '信息缺口识别中',
  targeted_search: '定向补搜规划中',
  deep_reading: '高价值内容深读中',
  evidence_merge: '证据汇总中',
  fact_verification: '关键事实核查中',
  uncertainty_marking: '不确定性标注中',
  report_planning: '报告大纲整理中',
  report_writing: '研究报告写作中',
  final_review: '最终审校中',
  completed: '研究任务已完成',
  failed: '研究任务失败',
  stopped: '研究任务已停止',
}

export const RESEARCH_DEFAULT_AXES = [
  '研究对象与边界',
  '产品与能力',
  '技术架构',
  '生态与竞争',
  '风险与改进建议',
]
