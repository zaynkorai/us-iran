/**
 * Mutator — The Self-Improvement Engine.
 *
 * Operates in batch mode across completed epochs. Generates mutation variants,
 * runs shadow trials, and commits only statistically significant improvements.
 *
 * 3-Phase Pipeline:
 *   Phase A: Generation — analyze failures, query vector memory, generate 3 variants
 *   Phase B: Shadow Trials — run variants against frozen baseline
 *   Phase C: Commitment — accept if LCB > baseline + delta, else archive
 *
 * @see docs/api_and_interfaces.md §1G — The Mutator
 * @see docs/engineering_implementation.md §6 — Mutator.evolve()
 * @see docs/self_improvement_loop.md — The full pipeline
 * @see docs/evaluation_and_math.md §2 — Statistical Thresholds
 */
import type { LLMClient } from "../llm/client.js";
import type { ActorAgent } from "./actor.js";
import type { GenericStateObject } from "../schemas/state.js";
import type { FrameworkConfig } from "../schemas/config.js";
import { MutatorProposal } from "../schemas/meta.js";

/** Result of a completed episode: [finalState, scoresMap] */
export type EpochResult = [GenericStateObject, Record<string, number>];

export class Mutator {
    private llmClient: LLMClient;
    private systemPrompt: string;
    /**
     * Tracks consecutive generations where no mutation beat the baseline.
     * Used by the Provisioner trigger formula.
     * @see docs/evaluation_and_math.md §4 — The Provisioner Trigger Formula
     */
    public plateauCounter: number = 0;

    constructor(systemPrompt: string, llmClient: LLMClient) {
        this.systemPrompt = systemPrompt;
        this.llmClient = llmClient;
    }

    /**
     * The 3-phase mutation pipeline.
     * Returns the winning agent if it passes acceptance criteria, or null.
     *
     * @see docs/engineering_implementation.md §6 — Mutator.evolve()
     */
    async evolve(
        agent: ActorAgent,
        epochResults: EpochResult[],
        config: FrameworkConfig,
        /**
         * A function to run shadow trials. This is injected to avoid circular
         * dependencies with EnvironmentManager.
         */
        runShadowTrial: (variant: ActorAgent) => Promise<number[]>,
    ): Promise<ActorAgent | null> {
        // --- Phase A: Generation ---
        // Identify worst 20% of episodes for THIS specific agent
        // Enforced by docs/self_improvement_loop.md §3A — Phase A: Generation
        const sorted = [...epochResults].sort((a, b) => (a[1][agent.id] ?? 0) - (b[1][agent.id] ?? 0));
        const failingSlice = sorted.slice(0, Math.ceil(sorted.length * 0.2));

        const failureSummary = failingSlice.map(([state, scores]) => ({
            final_state: state,
            agent_score: scores[agent.id] ?? 0,
        }));

        // Generate mutation variants via the Mutator LLM
        const prompt = JSON.stringify({
            agent_id: agent.id,
            current_strategy: agent.mutableStrategy,
            failing_episodes: failureSummary,
            mutation_count: config.mutation_variants,
        });

        const result = await this.llmClient.generateObject(
            MutatorProposal,
            this.systemPrompt,
            prompt,
            { temperature: 0.8 },
        );

        // Create ActorAgent instances for each variant
        const variants: ActorAgent[] = result.object.variants.map((v) =>
            agent.withMutatedStrategy(v.strategy_text, {
                temperature: v.hyperparameters.temperature,
                frequency_penalty: v.hyperparameters.frequency_penalty,
            }),
        );

        // --- Phase B: Shadow Trials (The Arena) ---
        // Enforced by docs/self_improvement_loop.md §3B — Phase B: Shadow Trials
        let bestVariant: ActorAgent | null = null;
        let bestScore = -Infinity;
        const baselineScore = this.calculateMean(epochResults.map((r) => r[1][agent.id] ?? 0));

        for (const variant of variants) {
            const shadowScores = await runShadowTrial(variant);
            const variantMean = this.calculateMean(shadowScores);
            if (variantMean > bestScore) {
                bestScore = variantMean;
                bestVariant = variant;
            }
        }

        // --- Phase C: Commitment or Archival ---
        // Enforced by docs/evaluation_and_math.md §2 — Acceptance Criteria (LCB)
        const delta = config.improvement_margin;
        if (bestVariant && bestScore > baselineScore + delta) {
            // Acceptance: statistically significant improvement
            this.plateauCounter = 0;
            return bestVariant;
        }

        // Rejection: increment plateau counter
        this.plateauCounter++;
        return null;
    }

    /**
     * Returns true if no improvement for `patience` consecutive generations.
     * When true, the Provisioner should be activated.
     * @see docs/self_creation_mechanics.md §1 — Mathematical Trigger Condition
     */
    isPlateaued(patience: number): boolean {
        return this.plateauCounter >= patience;
    }

    /** Calculate mean of a number array. */
    private calculateMean(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
}
