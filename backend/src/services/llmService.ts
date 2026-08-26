import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { env, providerModelMap, summaryConfig } from "../config/env.js";
import { ApiError } from "../errors.js";
import type { ClientSummaryProvider, LlmProvider } from "../types.js";

interface SummaryResult {
  summary: string;
  llmProvider: LlmProvider;
  clientProvider: ClientSummaryProvider;
  model: string;
}

const anthropicClient = env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  : null;
const openAiClient = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

function mapClientProviderToLlm(provider: ClientSummaryProvider): LlmProvider {
  return provider === "claude" ? "anthropic" : "openai";
}

function mapLlmProviderToClient(provider: LlmProvider): ClientSummaryProvider {
  return provider === "anthropic" ? "claude" : "openai";
}

function resolveProvider(override?: ClientSummaryProvider): LlmProvider {
  if (override) {
    return mapClientProviderToLlm(override);
  }
  return env.LLM_PROVIDER;
}

export async function generateSummary(
  articleText: string,
  providerOverride?: ClientSummaryProvider,
): Promise<SummaryResult> {
  const llmProvider = resolveProvider(providerOverride);
  const model = providerModelMap[llmProvider];
  const articleSnippet = articleText.slice(0, summaryConfig.maxArticleChars);
  const prompt = `Summarise the following article for spoken audio playback:\n\n${articleSnippet}`;

  if (llmProvider === "anthropic") {
    if (!anthropicClient) {
      throw new ApiError(
        500,
        "Anthropic API key is not configured. Add ANTHROPIC_API_KEY to backend/.env.",
      );
    }

    try {
      const message = await anthropicClient.messages.create({
        model,
        system: summaryConfig.systemPrompt,
        max_tokens: summaryConfig.maxOutputTokens,
        messages: [{ role: "user", content: prompt }],
      });

      const firstPart = message.content.find((part) => part.type === "text");
      const summary = firstPart?.text?.trim() ?? "";

      if (!summary) {
        throw new Error("Empty summary returned");
      }

      return {
        summary,
        llmProvider,
        clientProvider: mapLlmProviderToClient(llmProvider),
        model,
      };
    } catch (error) {
      throw new ApiError(502, `Failed to generate summary with Claude: ${String(error)}`);
    }
  }

  if (!openAiClient) {
    throw new ApiError(
      500,
      "OpenAI API key is not configured. Add OPENAI_API_KEY to backend/.env.",
    );
  }

  try {
    const completion = await openAiClient.responses.create({
      model,
      instructions: summaryConfig.systemPrompt,
      input: prompt,
      max_output_tokens: summaryConfig.maxOutputTokens,
    });

    const summary = (completion.output_text ?? "").trim();
    if (!summary) {
      throw new Error("Empty summary returned");
    }

    return {
      summary,
      llmProvider,
      clientProvider: mapLlmProviderToClient(llmProvider),
      model,
    };
  } catch (error) {
    throw new ApiError(502, `Failed to generate summary with OpenAI: ${String(error)}`);
  }
}
