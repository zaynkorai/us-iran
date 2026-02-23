/**
 * ActorAgent — The Primary Actor wrapper.
 * Stateless wrapper that constructs the Tripartite Prompt and calls the LLM.
 *
 * @see docs/api_and_interfaces.md §1C — The ActorAgent
 * @see docs/engineering_implementation.md §6 — ActorAgent.proposeAction()
 * @see docs/core_system_prompts.md §1 — The Tripartite Prompt Architecture
 */
import type { LLMClient } from "../llm/client.js";
import type { GenericStateObject } from "../schemas/state.js";
import { ActionProposal } from "../schemas/actions.js";
import type { ActionProposal as ActionProposalType } from "../schemas/actions.js";

export interface ActorAgentOptions {
    archetypeId: string;
    /** Layer 1: Immutable Core — defines WHO the agent is. Cannot be mutated. */
    immutableCore: string;
    /** Layer 2: Mutable Strategy — the current evolutionary tactic. Mutator controls this. */
    mutableStrategy: string;
    /** The LLM client for generating responses. */
    llmClient: LLMClient;
    /** LLM hyperparameters (temperature, frequency_penalty). */
    hyperparameters?: {
        temperature?: number;
        frequency_penalty?: number;
    };
}

export class ActorAgent {
    public readonly id: string;
    /** The combined Layer 1 + Layer 2 system prompt. */
    public systemPrompt: string;
    /** The immutable core goals — Mutator cannot change these. */
    // Enforced by docs/self_improvement_loop.md §5 — Critical Constraints
    public readonly immutableCore: string;
    /** The mutable strategy text — subject to mutation. */
    public mutableStrategy: string;

    private llmClient: LLMClient;
    private hyperparameters: { temperature?: number; frequency_penalty?: number };
    private retryContext: string | null = null;

    constructor(opts: ActorAgentOptions) {
        this.id = opts.archetypeId;
        this.immutableCore = opts.immutableCore;
        this.mutableStrategy = opts.mutableStrategy;
        this.systemPrompt = `${opts.immutableCore}\n${opts.mutableStrategy}`;
        this.llmClient = opts.llmClient;
        this.hyperparameters = opts.hyperparameters ?? {};
    }

    /**
     * Generate the agent's turn action. Uses the Vercel AI SDK's generateObject
     * for native Zod validation — no manual JSON.parse().
     *
     * The EnvironmentManager handles the retry loop; this method returns the raw
     * ActionProposal or throws.
     *
     * @see docs/engineering_implementation.md §6 — ActorAgent.proposeAction()
     */
    async proposeAction(currentState: GenericStateObject): Promise<{ proposal: ActionProposalType; tokenUsage: number }> {
        // Build 3-layer prompt (see docs/core_system_prompts.md §1)
        let systemContent = this.systemPrompt;
        if (this.retryContext) {
            systemContent += `\n\n[VALIDATION ERROR] ${this.retryContext}. Correct and try again.`;
            this.retryContext = null;
        }

        const result = await this.llmClient.generateObject(
            ActionProposal,
            systemContent,
            // Layer 3: Dynamic Context — the current environment state
            JSON.stringify(currentState),
            {
                temperature: this.hyperparameters.temperature ?? 0.7,
                frequencyPenalty: this.hyperparameters.frequency_penalty ?? 0.0,
            },
        );

        return { proposal: result.object, tokenUsage: result.tokenUsage };
    }

    /**
     * Store a Zod validation error message for the next retry attempt.
     * Called by the EnvironmentManager when proposeAction returns invalid output.
     * @see docs/engineering_implementation.md §6 — Validation Retry Loop
     */
    appendRetryContext(errorMessage: string): void {
        this.retryContext = errorMessage;
    }

    /**
     * Create a mutated copy of this agent with a new strategy and hyperparameters.
     * The immutable core is preserved.
     * @see docs/self_improvement_loop.md §5 — Immutable Core Goals
     */
    withMutatedStrategy(
        newStrategy: string,
        newHyperparameters?: { temperature?: number; frequency_penalty?: number },
    ): ActorAgent {
        return new ActorAgent({
            archetypeId: this.id,
            immutableCore: this.immutableCore,
            mutableStrategy: newStrategy,
            llmClient: this.llmClient,
            hyperparameters: newHyperparameters ?? this.hyperparameters,
        });
    }
}
