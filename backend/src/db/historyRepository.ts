import { pool } from "./pool.js";
import type { ClientSummaryProvider, HistoryItem } from "../types.js";

interface SaveHistoryParams {
  url: string;
  title: string | null;
  summary: string;
  voiceId: string;
  summaryProvider: ClientSummaryProvider;
  summaryModel: string;
}

export async function upsertSummaryHistory({
  url,
  title,
  summary,
  voiceId,
  summaryProvider,
  summaryModel,
}: SaveHistoryParams): Promise<void> {
  await pool.query(
    `
      INSERT INTO summaries (url, title, summary, voice_id, summary_provider, summary_model)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (url, summary_provider)
      DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        voice_id = EXCLUDED.voice_id,
        summary_model = EXCLUDED.summary_model,
        created_at = NOW();
    `,
    [url, title, summary, voiceId, summaryProvider, summaryModel],
  );
}

export async function listRecentHistory(limit = 20): Promise<HistoryItem[]> {
  const result = await pool.query<HistoryItem>(
    `
      SELECT id, url, title, summary, voice_id, summary_provider, summary_model, created_at::text
      FROM summaries
      ORDER BY created_at DESC
      LIMIT $1;
    `,
    [limit],
  );
  return result.rows;
}
