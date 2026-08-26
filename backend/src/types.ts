export type ClientSummaryProvider = "claude" | "openai";
export type LlmProvider = "anthropic" | "openai";

export interface SummariseBody {
  url?: string;
  provider?: ClientSummaryProvider;
  voice_id?: string;
}

export interface SpeakBody {
  text?: string;
  voice_id?: string;
}

export interface HistoryItem {
  id: number;
  url: string;
  title: string | null;
  summary: string;
  voice_id: string;
  summary_provider: ClientSummaryProvider;
  summary_model: string;
  created_at: string;
}
