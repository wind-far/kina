// 深度研究报告视图模型 store（按 record.id 分键的单例）。
// 拆分 ResearchReportRecord.vue 后，timeline / searchGroups / evidences / verification 等
// 全部从这里取，子组件只接收 recordId props 即可。
//
// 数据来源仍是 generate.vue 里写入 GeneratingRecord 的 research 字段；
// 本 store 的 syncFromRecord 把这些字段映射成稳定的 ViewModel，供组件订阅。

import { computed, reactive, type ComputedRef } from 'vue'
import type {
  ResearchEvidence,
  ResearchFact,
  ResearchOutlineSection,
  ResearchTokenUsage,
  ResearchVerificationResult,
} from '@/shared/research/research-types'
import type {
  ResearchSearchGroupViewItem,
  ResearchTimelineViewItem,
} from '@/views/generate/components/research-report-record.types'

export interface ResearchReportViewModel {
  recordId: string
  timeline: ResearchTimelineViewItem[]
  searchGroups: ResearchSearchGroupViewItem[]
  evidences: ResearchEvidence[]
  facts: ResearchFact[]
  outlineSections: ResearchOutlineSection[]
  verification: ResearchVerificationResult | null
  tokenUsage: ResearchTokenUsage | null
  verificationPending: boolean
}

export interface ResearchReportRecordSyncInput {
  recordId: string
  researchTimeline?: ResearchTimelineViewItem[]
  researchSearchGroups?: ResearchSearchGroupViewItem[]
  researchEvidences?: ResearchEvidence[]
  researchFacts?: ResearchFact[]
  researchOutlineSections?: ResearchOutlineSection[]
  researchVerification?: ResearchVerificationResult | null
  researchTokenUsage?: ResearchTokenUsage | null
  researchVerificationPending?: boolean
}

const records = reactive(new Map<string, ResearchReportViewModel>())

const buildEmptyViewModel = (recordId: string): ResearchReportViewModel => ({
  recordId,
  timeline: [],
  searchGroups: [],
  evidences: [],
  facts: [],
  outlineSections: [],
  verification: null,
  tokenUsage: null,
  verificationPending: false,
})

const getOrCreate = (recordId: string) => {
  const existing = records.get(recordId)
  if (existing) {
    return existing
  }
  const created = buildEmptyViewModel(recordId)
  records.set(recordId, created)
  return created
}

const syncFromRecord = (input: ResearchReportRecordSyncInput) => {
  if (!input?.recordId) {
    return
  }
  const target = getOrCreate(input.recordId)
  target.timeline = Array.isArray(input.researchTimeline) ? input.researchTimeline : []
  target.searchGroups = Array.isArray(input.researchSearchGroups) ? input.researchSearchGroups : []
  target.evidences = Array.isArray(input.researchEvidences) ? input.researchEvidences : []
  target.facts = Array.isArray(input.researchFacts) ? input.researchFacts : []
  target.outlineSections = Array.isArray(input.researchOutlineSections) ? input.researchOutlineSections : []
  target.verification = input.researchVerification || null
  target.tokenUsage = input.researchTokenUsage || null
  target.verificationPending = Boolean(input.researchVerificationPending)
}

const drop = (recordId: string) => {
  records.delete(recordId)
}

const dropAll = () => {
  records.clear()
}

export interface ResearchReportStore {
  records: Map<string, ResearchReportViewModel>
  getViewModel: (recordId: string) => ComputedRef<ResearchReportViewModel | null>
  syncFromRecord: (input: ResearchReportRecordSyncInput) => void
  drop: (recordId: string) => void
  dropAll: () => void
}

export const useResearchReportStore = (): ResearchReportStore => {
  return {
    records,
    getViewModel(recordId: string) {
      return computed(() => records.get(recordId) || null)
    },
    syncFromRecord,
    drop,
    dropAll,
  }
}
