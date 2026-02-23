/**
 * LLM Client — Thin wrapper around the Vercel AI SDK.
 *
 * The Vercel AI SDK (`ai` package) provides:
 *  - Provider-agnostic model interface (OpenAI, Anthropic, Google, local)
 *  - Built-in `generateObject()` with native Zod schema validation
 *  - Token usage tracking
 *
 * This wrapper gives the framework a clean interface without coupling
 * agent classes directly to the AI SDK imports.
 */
import type { LanguageModel } from "ai";
import { generateObject, generateText } from "ai";
import type { ZodType } from "zod/v4";

/** Options for an LLM generation request. */
export interface GenerateOptions {
    /** Override the default model for this request. */
    model?: LanguageModel;
    temperature?: number;
    frequencyPenalty?: number;
}

/** Result of a text generation (free-form). */
export interface TextResult {
    text: string;
    tokenUsage: number;
}

/** Result of a structured object generation (Zod-validated). */
export interface ObjectResult<T> {
    object: T;
    tokenUsage: number;
}

/**
 * Framework LLM client — wraps Vercel AI SDK's generateText/generateObject.
 * Agents hold a reference to this client and call it each turn.
 */
export class LLMClient {
    public readonly model: LanguageModel;

    constructor(model: LanguageModel) {
        this.model = model;
    }

    /**
     * Generate a free-form text response.
     */
    async generateText(
        system: string,
        prompt: string,
        options?: GenerateOptions,
    ): Promise<TextResult> {
        const result = await generateText({
            model: options?.model ?? this.model,
            system,
            prompt,
            temperature: options?.temperature ?? 0.7,
            frequencyPenalty: options?.frequencyPenalty ?? 0.0,
        });

        return {
            text: result.text,
            tokenUsage: result.usage.totalTokens ?? 0,
        };
    }

    /**
     * Generate a structured object validated against a Zod schema.
     * Uses the Vercel AI SDK's native `generateObject` — no manual JSON.parse().
     */
    async generateObject<T>(
        schema: ZodType<T>,
        system: string,
        prompt: string,
        options?: GenerateOptions,
    ): Promise<ObjectResult<T>> {
        const result = await generateObject({
            model: options?.model ?? this.model,
            schema,
            system,
            prompt,
            temperature: options?.temperature ?? 0.7,
            frequencyPenalty: options?.frequencyPenalty ?? 0.0,
        });

        return {
            object: result.object as T,
            tokenUsage: result.usage.totalTokens ?? 0,
        };
    }
}
