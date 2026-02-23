/**
 * Provisioner — The Self-Creation Engine.
 *
 * Designs entirely new agents when the Mutator detects a structural deadlock
 * (K consecutive generations of plateau).
 *
 * @see docs/api_and_interfaces.md §1G — The Provisioner
 * @see docs/engineering_implementation.md §6 — Provisioner.designAgent()
 * @see docs/self_creation_mechanics.md — Full mechanics
 * @see docs/core_system_prompts.md §2 — The Provisioner Prompt
 */
import type { LLMClient } from "../llm/client.js";
import type { GenericStateObject } from "../schemas/state.js";
import { NewAgentProvisioning } from "../schemas/meta.js";
import type { NewAgentProvisioning as NewAgentProvisioningType } from "../schemas/meta.js";
import { UnsafeAgentDesignError } from "../errors/index.js";
import type { EpochResult } from "./mutator.js";

export class Provisioner {
    private systemPrompt: string;
    private llmClient: LLMClient;

    constructor(systemPrompt: string, llmClient: LLMClient) {
        this.systemPrompt = systemPrompt;
        this.llmClient = llmClient;
    }

    /**
     * Analyze a structural deadlock and output a complete agent specification.
     *
     * Safety guardrails:
     * - Created agents CANNOT trigger abort_episode
     * - Created agents CANNOT propose resolution
     * - Max 3 state mutations per turn
     *
     * @see docs/engineering_implementation.md §6 — Provisioner.designAgent()
     */
    async designAgent(
        currentState: GenericStateObject,
        epochResults: EpochResult[],
        failedArchetypes: string[],
        semanticMemoryContext?: object[],
    ): Promise<NewAgentProvisioningType> {
        // Phase 1: Architectural Analysis (LLM-driven analysis of the deadlock)
        const deadlockSummary = await this.analyzeDeadlock(currentState, epochResults, semanticMemoryContext);

        // State Pruning: Do not dump the entire history, just the structure and environmental variables
        const prunedState = {
            environmental_variables: currentState.variables,
            turn_number: currentState.turn_number,
            // Exclude actionLogs/transcript from this prompt; handled in the semantic memory context
        };

        // Phase 2: LLM-driven Agent Design
        const prompt = JSON.stringify({
            deadlock_summary: deadlockSummary,
            current_state_structure: prunedState,
            failed_archetypes: failedArchetypes,
        });

        const result = await this.llmClient.generateObject(
            NewAgentProvisioning,
            this.systemPrompt,
            prompt,
            // Higher creativity for novel agent design
            { temperature: 0.9 },
        );

        const spec = result.object;

        // Phase 4: Safety guardrails — reject game-breaking capabilities
        // Enforced by docs/engineering_implementation.md §6
        if (spec.permissions.can_abort_episode) {
            throw new UnsafeAgentDesignError("Created agents cannot trigger abort_episode");
        }
        if (spec.permissions.can_propose_resolution) {
            throw new UnsafeAgentDesignError("Created agents cannot trigger propose_resolution");
        }
        if (spec.permissions.max_state_mutations_per_turn > 3) {
            throw new UnsafeAgentDesignError("Created agents limited to 3 mutations/turn max");
        }

        return spec;
    }

    /**
     * Analyze an epoch's results and semantic history to summarize the deadlock pattern.
     * Identifies common termination reasons and structural gaps.
     */
    private async analyzeDeadlock(
        currentState: GenericStateObject,
        epochResults: EpochResult[],
        semanticMemoryContext?: object[]
    ): Promise<string> {
        const scores = epochResults.map(([_, a, b]) => ({ agent_a: a, agent_b: b }));
        const avgA = scores.reduce((s, r) => s + r.agent_a, 0) / scores.length;
        const avgB = scores.reduce((s, r) => s + r.agent_b, 0) / scores.length;

        const analysisPrompt = JSON.stringify({
            instruction: "Analyze the current state and semantic history. Why are the agents deadlocked? Identify the immutable goals causing friction and gaps in the State Object.",
            average_scores: { agent_a: avgA, agent_b: avgB },
            semantic_memory: semanticMemoryContext ?? [],
            environmental_variables: currentState.variables,
        });

        const analysisResult = await this.llmClient.generateText(
            this.systemPrompt,
            analysisPrompt,
            { temperature: 0.5 }
        );

        return analysisResult.text;
    }
}
