/**
 * Action Schemas — Output schemas for agents during the execution loop.
 * Enforced by docs/engineering_implementation.md §3 and docs/agent_design_and_state.md §2
 */
import { z } from "zod/v4";
import { StateMutation } from "./state.js";

/**
 * The structured output every Primary Actor must return on their turn.
 * Validated by the EnvironmentManager via Zod before state mutations are applied.
 * @see docs/engineering_implementation.md §3 — ActionProposal Output Schema
 */
export const ActionProposal = z.object({
    internal_monologue: z.string().describe("Your hidden reasoning (Chain of Thought)."),
    public_dialogue: z.string().describe("What you explicitly say to the other agent."),
    state_mutations: z.array(StateMutation).describe("Proposed changes to the state."),
    propose_resolution: z.boolean().default(false),
    abort_episode: z.boolean().default(false),
});
export type ActionProposal = z.infer<typeof ActionProposal>;

/**
 * Output from an Information Disruptor (e.g., Media Agent).
 * @see docs/agent_design_and_state.md §2B — Stochastic Shock Output Schema
 */
export const DisruptorReport = z.object({
    headline: z.string(),
    severity: z.enum(["low", "medium", "high"]),
    inject_into_transcript: z.boolean().default(true),
});
export type DisruptorReport = z.infer<typeof DisruptorReport>;

/**
 * Output from a Tension Disruptor.
 * @see docs/agent_design_and_state.md §2C — Disruptor Output Schema
 */
export const TensionUpdate = z.object({
    new_tension_level: z.number().int().min(1).max(10),
    rationale: z.string(),
});
export type TensionUpdate = z.infer<typeof TensionUpdate>;

/**
 * The Judge's evaluation output for a completed episode.
 * Scores are integers from -5 to +5.
 * @see docs/evaluation_and_math.md §1 — The Judge's Scoring Formula
 */
export const JudgeEvaluation = z.object({
    agent_a_score: z.number().int().min(-5).max(5),
    agent_b_score: z.number().int().min(-5).max(5),
    agent_a_rationale: z.string(),
    agent_b_rationale: z.string(),
});
export type JudgeEvaluation = z.infer<typeof JudgeEvaluation>;
