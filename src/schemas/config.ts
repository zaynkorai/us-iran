/**
 * Framework Configuration — All tunable parameters in one place.
 * @see docs/engineering_implementation.md §4 — Configuration
 * @see docs/explorer_agent.md §6 — Explorer Settings
 */
import { z } from "zod/v4";

/**
 * The single configuration object controlling all tunable framework parameters.
 * Developers pass this to `EnvironmentManager` and all Meta-Agents.
 */
export const FrameworkConfig = z.object({
    // --- Episode Limits ---
    /** Maximum turns before an episode times out. */
    max_turns_per_episode: z.number().int().default(20),
    /** Hard token limit per episode (cost circuit breaker). */
    max_episode_tokens: z.number().int().default(50000),
    /** Max concurrent episodes during an epoch or shadow trial. */
    max_concurrency: z.number().int().default(5),

    // --- Mutation Settings ---
    /** Number of episodes per epoch. */
    epoch_size: z.number().int().default(10),
    /** Number of strategy variants generated per mutation cycle. */
    mutation_variants: z.number().int().default(3),
    /** Number of episodes per shadow trial. */
    shadow_trial_count: z.number().int().default(10),
    /** Delta required for a mutation to be accepted over baseline. */
    improvement_margin: z.number().default(0.5),

    // --- Creation Settings ---
    /** K generations of plateau before triggering the Provisioner. */
    creation_patience: z.number().int().default(5),
    /** Maximum simultaneously active Provisioner-created agents. */
    max_active_created_agents: z.number().int().default(3),
    /** Cooldown generations after a creation attempt. */
    creation_cooldown_generations: z.number().int().default(3),
    /** Whether to pause for human approval before deploying a created agent. */
    require_human_approval_for_creation: z.boolean().default(true),

    // --- Error Handling ---
    /** Max Zod validation retries before forced concession. */
    max_validation_retries: z.number().int().default(3),
    /** Forced concession penalties before episode termination. */
    forced_concession_threshold: z.number().int().default(2),

    // --- Explorer Settings ---
    /** Run Explorer scan every S generations. */
    // Enforced by docs/explorer_agent.md §6 — Scheduling Triggers
    scout_sweep_interval_generations: z.number().int().default(5),
    /** Trigger Explorer scan when a new ingredient is ingested. */
    scout_on_new_ingredient: z.boolean().default(true),

    // --- Disruptor Settings ---
    /** Information disruptor fires every N turns. */
    info_disruptor_frequency: z.number().int().default(3),
    /** Summarization agent fires every N turns. */
    // Enforced by docs/context_management_and_summarization.md §2
    summarization_frequency: z.number().int().default(5),
});
export type FrameworkConfig = z.infer<typeof FrameworkConfig>;
