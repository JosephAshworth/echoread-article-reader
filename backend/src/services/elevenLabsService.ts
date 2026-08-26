import { Readable } from "node:stream";
import { env } from "../config/env.js";
import { ApiError } from "../errors.js";

interface VoiceResponse {
  voice_id: string;
  name: string;
}

interface ElevenLabsErrorPayload {
  detail?: string | { message?: string };
  message?: string;
}

function parseElevenLabsError(payload: ElevenLabsErrorPayload | null, status: number): string {
  const fallback = `Failed to generate audio with ElevenLabs (status ${status}).`;
  if (!payload) {
    return fallback;
  }
  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  if (
    typeof payload.detail === "object" &&
    payload.detail &&
    typeof payload.detail.message === "string" &&
    payload.detail.message.trim()
  ) {
    return payload.detail.message;
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return fallback;
}

export async function createSpeechStream(
  text: string,
  voiceId: string,
): Promise<{ stream: Readable; contentType: string }> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": env.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
    }),
  });

  if (!response.ok) {
    let payload: ElevenLabsErrorPayload | null = null;
    try {
      payload = (await response.json()) as ElevenLabsErrorPayload;
    } catch {
      payload = null;
    }
    throw new ApiError(502, parseElevenLabsError(payload, response.status));
  }

  if (!response.body) {
    throw new ApiError(502, "ElevenLabs returned an empty audio stream.");
  }

  return {
    stream: Readable.fromWeb(response.body as never),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}

export async function listVoices(): Promise<VoiceResponse[]> {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new ApiError(502, "Failed to fetch voices from ElevenLabs.");
  }

  const payload = (await response.json()) as { voices?: Array<{ voice_id?: string; name?: string }> };
  return (payload.voices ?? [])
    .filter((voice) => voice.voice_id && voice.name)
    .map((voice) => ({
      voice_id: voice.voice_id as string,
      name: voice.name as string,
    }));
}
