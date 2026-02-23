/**
 * Critic (Judge) — The isolated evaluator.
 *
 * The Judge has NO memory across episodes. It evaluates each episode's
 * final state against secret scoring rubrics.
 *
 * @see docs/api_and_interfaces.md §1E — The Critic
 * @see docs/evaluation_and_math.md — The Judge's Scoring Formula
 * @see docs/core_system_prompts.md §2 — The Judge Prompt
 */
import type { LLMClient } from "../llm/client.js";
import type { GenericStateObject } from "../schemas/state.js";
import { JudgeEvaluation } from "../schemas/actions.js";
import type { JudgeEvaluation as JudgeEvaluationType } from "../schemas/actions.js";

export class Critic {
    private rubric: string;
    private systemPrompt: string;
    private llmClient: LLMClient;

    constructor(rubric: string, systemPrompt: string, llmClient: LLMClient) {
        this.rubric = rubric;
        this.systemPrompt = systemPrompt;
        this.llmClient = llmClient;
    }

    /**
     * Evaluate a completed episode.
     * Returns scores from -5 to +5 for each agent, with rationale.
     *
     * The Judge sees the RAW log (not the pruned version actors see).
     * @see docs/context_management_and_summarization.md §5 — Mathematical Enforcement
     */
    async evaluate(
        initialState: GenericStateObject,
        finalState: GenericStateObject,
        transcript: object[],
    ): Promise<{ scores: Record<string, number>; rationales: Record<string, string> }> {
        const prompt = JSON.stringify({
            scoring_rubric: this.rubric,
            initial_state: initialState,
            final_state: finalState,
            transcript,
            total_turns: finalState.turn_number,
        });

        const result = await this.llmClient.generateObject(
            JudgeEvaluation,
            this.systemPrompt,
            prompt,
            // Low temperature for consistent, rigorous evaluation
            { temperature: 0.3 },
        );

        // Transform structured array back into records for internal framework consumption
        const scores: Record<string, number> = {};
        const rationales: Record<string, string> = {};

        for (const evaluation of result.object.individual_evaluations) {
            scores[evaluation.agent_id] = evaluation.score;
            rationales[evaluation.agent_id] = evaluation.rationale;
        }

        return { scores, rationales };
    }
}
