import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Resolves a LanguageModel based on provider and model names.
 * Falls back to SISC_PROVIDER and SISC_MODEL environment variables.
 * Defaults to OpenAI gpt-5-nano if nothing is specified.
 */
export function resolveLanguageModel(
    providerName?: string,
    modelId?: string
): LanguageModel {
    const provider = providerName || process.env.SISC_PROVIDER || "openai";
    const model = modelId || process.env.SISC_MODEL;

    switch (provider.toLowerCase()) {
        case "openai":
            return openai(model || "gpt-5-nano");
        case "google":
            return google(model || "gemini-1.5-pro");
        case "anthropic":
            return anthropic(model || "claude-3-5-sonnet-latest");
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}
