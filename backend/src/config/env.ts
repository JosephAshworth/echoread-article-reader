import dotenv from "dotenv";
import { z } from "zod";
import type { LlmProvider } from "../types.js";

dotenv.config();

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required."),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  LLM_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  PORT: z.coerce.number().default(8000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues.map((issue) => issue.message).join(" ");
  throw new Error(`Invalid environment configuration: ${message}`);
}

export const env = parsed.data;

export const summaryConfig = {
  systemPrompt:
    "You are a helpful assistant that produces concise, conversational, audio-friendly summaries. Keep summaries to no more than 150 words. Write in clear spoken language without bullet points or markdown.",
  maxArticleChars: 12_000,
  maxOutputTokens: 300,
};

export const defaultVoiceId = "21m00Tcm4TlvDq8ikWAM";

export const providerModelMap: Record<LlmProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
};
