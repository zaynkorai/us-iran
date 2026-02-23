/**
 * DisruptorAgent — Information and Tension disruptors.
 *
 * Information disruptors generate sensationalized headlines (Stochastic Shocks).
 * Tension disruptors output anxiety levels that affect global_tension_level.
 *
 * @see docs/api_and_interfaces.md §1D — The DisruptorAgent
 * @see docs/core_system_prompts.md §2 — The Disruptor Prompt
 */
import type { LLMClient } from "../llm/client.js";
import type { GenericStateObject } from "../schemas/state.js";
import { DisruptorReport, TensionUpdate } from "../schemas/actions.js";
import type {
    DisruptorReport as DisruptorReportType,
    TensionUpdate as TensionUpdateType,
} from "../schemas/actions.js";

export interface DisruptorAgent {
    readonly type: "information" | "tension";
    observe(transcript: object[], state: GenericStateObject): Promise<unknown>;
}

export class InformationDisruptor implements DisruptorAgent {
    public readonly type = "information";
    private systemPrompt: string;
    private llmClient: LLMClient;

    constructor(systemPrompt: string, llmClient: LLMClient) {
        this.systemPrompt = systemPrompt;
        this.llmClient = llmClient;
    }

    async observe(
        transcript: object[],
        state: GenericStateObject,
    ): Promise<DisruptorReportType> {
        const prompt = JSON.stringify({
            recent_transcript: transcript.slice(-5),
            current_state: state,
        });

        const result = await this.llmClient.generateObject(
            DisruptorReport,
            this.systemPrompt,
            prompt,
            { temperature: 0.9 },
        );
        return result.object;
    }
}

export class TensionDisruptor implements DisruptorAgent {
    public readonly type = "tension";
    private systemPrompt: string;
    private llmClient: LLMClient;

    constructor(systemPrompt: string, llmClient: LLMClient) {
        this.systemPrompt = systemPrompt;
        this.llmClient = llmClient;
    }

    async observe(
        transcript: object[],
        state: GenericStateObject,
    ): Promise<TensionUpdateType> {
        const prompt = JSON.stringify({
            recent_transcript: transcript.slice(-5),
            current_state: state,
        });

        const result = await this.llmClient.generateObject(
            TensionUpdate,
            this.systemPrompt,
            prompt,
            { temperature: 0.5 },
        );
        return result.object;
    }
}
