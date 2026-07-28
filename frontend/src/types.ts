export interface Voice {
  voice_id: string
  name: string
}

export interface SummariseResponse {
  summary: string
}

export interface ApiErrorResponse {
  detail?: string | { msg?: string }[]
}

export interface HistoryItem {
  id: number
  url: string
  title: string | null
  summary: string
  voice_id: string
  created_at: string
}
