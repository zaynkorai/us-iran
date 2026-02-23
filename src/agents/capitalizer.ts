/**
 * Capitalizer — The strategic Interjector that finds hidden overlaps.
 *
 * Eavesdrops on internal monologues and calculates mathematical overlap
 * in hidden goals, whispering strategic hints to accelerate resolution.
 *
 * @see docs/api_and_interfaces.md §1F — The Capitalizer
 * @see docs/capitalizer_agent.md — Full design
 * @see docs/core_system_prompts.md §2 — The Capitalizer Prompt
 */
import type { LLMClient } from "../llm/client.js";
import type { GenericStateObject } from "../schemas/state.js";
import { CapitalizerHint } from "../schemas/meta.js";
import type { CapitalizerHint as CapitalizerHintType } from "../schemas/meta.js";

/** An action log entry for the Capitalizer to analyze. */
export interface ActionLogEntry {
    turn: number;
    speakerId: string;
    internal_monologue?: string;
    public_dialogue?: string;
    [key: string]: unknown;
}

export class Capitalizer {
    private systemPrompt: string;
    private llmClient: LLMClient;

    constructor(systemPrompt: string, llmClient: LLMClient) {
        this.systemPrompt = systemPrompt;
        this.llmClient = llmClient;
    }

    /**
     * Analyze the current state and recent internal monologues to calculate
     * strategic overlap and generate a hint for the next speaker.
     *
     * Privacy constraints are enforced by the prompt — the Capitalizer must NOT
     * directly quote an opponent's internal monologue.
     * @see docs/capitalizer_agent.md §3 — Privacy and Sandboxing
     */
    async analyzeOverlap(
        currentState: GenericStateObject,
        recentLogBook: ActionLogEntry[],
    ): Promise<CapitalizerHintType> {
        const prompt = JSON.stringify({
            current_state: currentState,
            recent_monologues: recentLogBook.map((log) => ({
                speaker: log.speakerId,
                internal_monologue: log.internal_monologue,
                public_dialogue: log.public_dialogue,
            })),
        });

        const result = await this.llmClient.generateObject(
            CapitalizerHint,
            this.systemPrompt,
            prompt,
            { temperature: 0.6 },
        );

        // Programmatic Anti-Hallucination Privacy Filter
        // Enforced by docs/capitalizer_agent.md §3 — Privacy and Sandboxing
        // Ensure no direct quotation of internal monologues leaks into the hint.
        for (const log of recentLogBook) {
            if (!log.internal_monologue) continue;

            const fragments = log.internal_monologue
                .split(/[.?!;\n]/)
                .map((s) => s.trim())
                .filter((s) => s.length > 20);

            for (const fragment of fragments) {
                if (result.object.strategic_hint.includes(fragment)) {
                    result.object.strategic_hint = "[REDACTED BY PRIVACY FILTER: Attempted to leak internal monologue]";
                    return result.object;
                }
            }
        }

        return result.object;
    }
}
