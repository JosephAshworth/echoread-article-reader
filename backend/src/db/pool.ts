import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export async function initializeDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS summaries (
      id SERIAL PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NULL,
      summary TEXT NOT NULL,
      voice_id TEXT NOT NULL,
      summary_provider TEXT NOT NULL,
      summary_model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS summaries_url_provider_idx
    ON summaries (url, summary_provider);
  `);
}
