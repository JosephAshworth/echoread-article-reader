export interface Voice {
  voice_id: string
  name: string
}

export type SummaryProvider = 'claude' | 'openai'

export interface SummariseResponse {
  summary: string
  provider: SummaryProvider
}

export interface ApiErrorResponse {
  detail?: string | { msg?: string }[] | { message?: string }
}

export interface HistoryItem {
  id: number
  url: string
  title: string | null
  summary: string
  voice_id: string
  summary_provider: SummaryProvider
  summary_model: string
  created_at: string
}
