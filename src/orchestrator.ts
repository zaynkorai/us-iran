/**
 * Orchestrator — The high-level generation loop.
 *
 * Implements the 4-phase framework lifecycle:
 *   1. Execution — run an Epoch of Episodes
 *   2. Evaluation — Judge scores each episode
 *   3. Mutation — Mutator evolves or archives strategies
 *   4. Creation — Provisioner designs new agents (if plateaued)
 *
 * @see docs/engineering_implementation.md §5 — Example Execution Script
 * @see docs/system_architecture.md §5 — High-Level Lifecycle
 */
import pLimit from "p-limit";
import { EnvironmentManager } from "./core/environment.js";
import { ActorAgent } from "./agents/actor.js";
import { Critic } from "./agents/critic.js";
import { Mutator } from "./agents/mutator.js";
import { Provisioner } from "./agents/provisioner.js";
import type { Explorer } from "./agents/explorer.js";
import type { Capitalizer } from "./agents/capitalizer.js";
import type { TensionDisruptor, InformationDisruptor } from "./agents/disruptor.js";
import type { GenericStateObject } from "./schemas/state.js";
import type { FrameworkConfig } from "./schemas/config.js";
import type { LLMClient } from "./llm/client.js";
import type { EpochResult } from "./agents/mutator.js";

export interface OrchestratorOptions {
    config: FrameworkConfig;
    initialState: GenericStateObject;
    agents: Record<string, ActorAgent>;
    judge: Critic;
    mutator: Mutator;
    provisioner: Provisioner;
    llmClient: LLMClient;
    explorer?: Explorer;
    capitalizer?: Capitalizer;
    tensionDisruptor?: TensionDisruptor;
    infoDisruptor?: InformationDisruptor;
    /** Maximum number of generations to run. Default: 100 */
    maxGenerations?: number;
    /** Callback for human-in-the-loop approval of Provisioner-created agents. */
    onCreationApproval?: (spec: object) => Promise<boolean>;
    /** Callback for logging/monitoring each generation. */
    onGenerationComplete?: (generation: number, results: EpochResult[]) => void;
}

/**
 * Run the full simulation lifecycle.
 *
 * @see docs/engineering_implementation.md §5 — Example Execution Script
 */
export async function runFullSimulation(options: OrchestratorOptions): Promise<void> {
    const {
        config,
        initialState,
        agents,
        judge,
        mutator,
        provisioner,
        llmClient,
        explorer,
        capitalizer,
        tensionDisruptor,
        infoDisruptor,
        maxGenerations = 100,
        onCreationApproval,
        onGenerationComplete,
    } = options;

    // Track the mutable agent references and creation attempts
    const activeAgents = { ...agents };
    const failedArchetypes: string[] = [];

    for (let generation = 0; generation < maxGenerations; generation++) {
        // --- Phase 1: Run an Epoch ---
        // Enforced by docs/system_architecture.md §5 — Execution Phase
        const epochResults: EpochResult[] = [];
        const limit = pLimit(config.max_concurrency ?? 5);

        const episodePromises = Array.from({ length: config.epoch_size }).map(() =>
            limit(async () => {
                const env = new EnvironmentManager(structuredClone(initialState), config);
                env.turnOrder = Object.keys(activeAgents);

                // Wire Meta-Agents if provided
                if (capitalizer) env.setCapitalizer(capitalizer);
                if (tensionDisruptor) env.setTensionAgent(tensionDisruptor);
                if (infoDisruptor) env.setInfoDisruptor(infoDisruptor);

                const [finalState, transcript] = await env.runEpisode(activeAgents);
                const evaluation = await judge.evaluate(
                    initialState,
                    finalState,
                    transcript,
                );
                return [finalState, evaluation.agent_a_score, evaluation.agent_b_score] as EpochResult;
            })
        );
        epochResults.push(...(await Promise.all(episodePromises)));

        onGenerationComplete?.(generation, epochResults);

        // --- Phase 2: Self-Improvement (Mutate) ---
        // Enforced by docs/system_architecture.md §5 — Mutation Phase
        // Find the first primary actor to evolve
        const primaryActorId = Object.keys(agents)[0];
        const primaryAgent = activeAgents[primaryActorId];

        if (primaryAgent) {
            const runShadowTrial = async (variant: ActorAgent): Promise<number[]> => {
                const trialPromises = Array.from({ length: config.shadow_trial_count }).map(() =>
                    limit(async () => {
                        const shadowEnv = new EnvironmentManager(structuredClone(initialState), config);
                        shadowEnv.turnOrder = Object.keys(activeAgents);
                        const shadowAgents = { ...activeAgents, [primaryActorId]: variant };
                        const [finalState, transcript] = await shadowEnv.runEpisode(shadowAgents);
                        const eval_ = await judge.evaluate(initialState, finalState, transcript);
                        return eval_.agent_a_score;
                    })
                );
                return Promise.all(trialPromises);
            };

            const newAgent = await mutator.evolve(primaryAgent, epochResults, config, runShadowTrial);
            if (newAgent) {
                activeAgents[primaryActorId] = newAgent;
                continue; // Mutation succeeded; skip creation
            }
        }

        // --- Phase 3: Self-Creation (if plateau detected) ---
        // Enforced by docs/system_architecture.md §5 — Creation Phase
        if (mutator.isPlateaued(config.creation_patience)) {
            const newAgentSpec = await provisioner.designAgent(
                initialState,
                epochResults,
                failedArchetypes
            );

            // Human-in-the-loop gate
            // Enforced by docs/safety_and_sandboxing.md §3 — HITL for Creation
            if (config.require_human_approval_for_creation) {
                const approved = onCreationApproval
                    ? await onCreationApproval(newAgentSpec)
                    : false;
                if (!approved) continue;
            }

            // Phase 3b: The Shadow Test
            const baseAvgA = epochResults.reduce((s, r) => s + r[1], 0) / epochResults.length;
            const shadowEnv = new EnvironmentManager(structuredClone(initialState), config);

            shadowEnv.turnOrder = Object.keys(activeAgents);
            const shadowAgent = shadowEnv.mountAgent(newAgentSpec, llmClient);
            const shadowAgents = { ...activeAgents, [newAgentSpec.agent_id]: shadowAgent };

            const shadowTrialPromises = Array.from({ length: config.shadow_trial_count }).map(() =>
                limit(async () => {
                    const env = new EnvironmentManager(structuredClone(initialState), config);
                    env.turnOrder = shadowEnv.turnOrder; // Use the injected sequence
                    const [finalState, transcript] = await env.runEpisode(shadowAgents);
                    const eval_ = await judge.evaluate(initialState, finalState, transcript);
                    return eval_.agent_a_score;
                })
            );

            const shadowScores = await Promise.all(shadowTrialPromises);
            const shadowAvgA = shadowScores.reduce((s, score) => s + score, 0) / shadowScores.length;

            if (shadowAvgA > baseAvgA + config.improvement_margin) {

                const env = new EnvironmentManager(structuredClone(initialState), config);
                env.turnOrder = Object.keys(activeAgents);
                const newAgent = env.mountAgent(newAgentSpec, llmClient);
                activeAgents[newAgentSpec.agent_id] = newAgent;
            } else {
                failedArchetypes.push(newAgentSpec.archetype); // Only record the archetype archetype ID
            }
        }

        // --- Explorer sweep (periodic) ---
        // Enforced by docs/explorer_agent.md §6 — Cron-based trigger
        if (explorer && generation % config.scout_sweep_interval_generations === 0) {
            const hypotheses = await explorer.scan();

            (initialState as GenericStateObject).scout_hypotheses = hypotheses.map((h) => ({
                title: h.title,
                feasibility_score: h.feasibility_score,
                disruption_target: h.disruption_target,
            }));
        }
    }
}
