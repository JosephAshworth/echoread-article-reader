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
