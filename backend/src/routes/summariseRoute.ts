import { Router } from "express";
import { defaultVoiceId } from "../config/env.js";
import { upsertSummaryHistory } from "../db/historyRepository.js";
import { ApiError } from "../errors.js";
import { fetchArticleContent } from "../services/articleService.js";
import { generateSummary } from "../services/llmService.js";
import type { SummariseBody } from "../types.js";

export const summariseRouter = Router();

function assertValidUrl(value: string): void {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new ApiError(400, "Please provide a valid article URL.");
  }
}

summariseRouter.post("/", async (req, res, next) => {
  try {
    const { url, provider, voice_id: voiceIdRaw } = req.body as SummariseBody;
    const trimmedUrl = (url ?? "").trim();
    assertValidUrl(trimmedUrl);

    const { text, title } = await fetchArticleContent(trimmedUrl);
    if (text.length < 100) {
      throw new ApiError(422, "The article content was too short to summarise.");
    }

    const { summary, clientProvider, model } = await generateSummary(text, provider);
    const voiceId = (voiceIdRaw ?? "").trim() || defaultVoiceId;

    await upsertSummaryHistory({
      url: trimmedUrl,
      title,
      summary,
      voiceId,
      summaryProvider: clientProvider,
      summaryModel: model,
    });

    return res.status(200).json({
      summary,
      provider: clientProvider,
    });
  } catch (error) {
    return next(error);
  }
});
