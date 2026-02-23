/**
 * State Schemas — Core state management types for the framework.
 * Enforced by docs/agent_design_and_state.md and docs/engineering_implementation.md §3
 */
import { z } from "zod/v4";

/**
 * A single mutation proposed by an agent to modify the GenericStateObject.
 * @see docs/engineering_implementation.md §3 — ActionProposal Output Schema
 */
export const StateMutation = z.object({
    action: z.enum(["modify", "add"]),
    path: z.string().describe("The generic path in the state object to modify"),
    value: z.any().describe("The new value"),
});
export type StateMutation = z.infer<typeof StateMutation>;

/**
 * Summary of an Explorer convergence hypothesis, injected into the state
 * for Primary Actors to debate.
 * @see docs/explorer_agent.md §6 — Phase 3: Injection into the Debate
 */
export const ConvergenceHypothesisSummary = z.object({
    title: z.string(),
    feasibility_score: z.number().int().min(1).max(10),
    disruption_target: z.string(),
});
export type ConvergenceHypothesisSummary = z.infer<typeof ConvergenceHypothesisSummary>;

/**
 * The core state object shared across the entire environment.
 * All agents interact with this structured JSON rather than raw text transcripts.
 * @see docs/api_and_interfaces.md §1A — The GenericStateObject
 */
export const GenericStateObject = z.object({
    /** The core turn management fields. */
    turn_number: z.number().int().default(0),
    current_speaker_id: z.string(),
    is_terminal: z.boolean().default(false),

    /** Hypotheses injected by the Explorer Agent for Primary Actors to debate. */
    scout_hypotheses: z.array(ConvergenceHypothesisSummary).optional(),

    /**
     * Developer-extensible variables for domain-specific state.
     * e.g., us_iran_parameters: { sanctions_relief_percentage: 50 }
     */
    variables: z.record(z.string(), z.any()),

    /**
     * Injections from Meta-Agents (e.g., Capitalizer hints).
     * Populated by the EnvironmentManager before each turn.
     */
    injections: z.record(z.string(), z.any()).optional(),
});
export type GenericStateObject = z.infer<typeof GenericStateObject>;
