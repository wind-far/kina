export interface AgentUser {
  name: string
  avatarSrc?: string
}

export interface AgentTaskStep {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'error'
  description?: string
}

export interface AgentImageResult {
  id: string
  imageSrc: string
  promptText?: string
}

export interface AgentRunResult {
  title?: string
  summary?: string
  images?: AgentImageResult[]
  expectedImageCount?: number
  outputVisible?: boolean
  pointCost?: number
}

export interface AgentTaskIndicatorState {
  status: 'idle' | 'thinking' | 'running' | 'completed' | 'error' | 'stopped'
  title: string
  description?: string
}

export interface AgentProcessTaskItem {
  id: string
  title: string
  status: 'pending' | 'running' | 'generated' | 'completed' | 'error'
}

export interface AgentProcessSection {
  key: string
  kind: 'skill' | 'reasoning'
  label: string
  paragraphs?: string[]
  taskItems?: AgentProcessTaskItem[]
}

export interface AgentRunState {
  id: string
  query: string
  skill: string
  status: 'idle' | 'thinking' | 'running' | 'completed' | 'error' | 'stopped'
  user?: AgentUser
  steps: AgentTaskStep[]
  indicator?: AgentTaskIndicatorState
  result?: AgentRunResult
  processSections?: AgentProcessSection[]
}
