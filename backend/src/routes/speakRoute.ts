import { Router } from "express";
import { defaultVoiceId } from "../config/env.js";
import { ApiError } from "../errors.js";
import { createSpeechStream } from "../services/elevenLabsService.js";
import type { SpeakBody } from "../types.js";

export const speakRouter = Router();

speakRouter.post("/", async (req, res, next) => {
  try {
    const { text, voice_id: voiceIdRaw } = req.body as SpeakBody;
    const trimmedText = (text ?? "").trim();
    if (!trimmedText) {
      throw new ApiError(400, "Text is required for speech synthesis.");
    }

    const voiceId = (voiceIdRaw ?? "").trim() || defaultVoiceId;
    const { stream, contentType } = await createSpeechStream(trimmedText, voiceId);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline; filename=summary.mp3");
    stream.pipe(res);
    return undefined;
  } catch (error) {
    return next(error);
  }
});
