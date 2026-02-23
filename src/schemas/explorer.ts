/**
 * Explorer Schemas — Data structures for the Possibility Researcher agent.
 * @see docs/explorer_agent.md — The Explorer Agent
 */
import { z } from "zod/v4";

/**
 * A single ingredient in the Explorer's Ingredient Graph.
 * Represents a publicly available technology, model, API, or capability.
 * @see docs/explorer_agent.md §3 — The Ingredient Graph
 */
export const Ingredient = z.object({
    ingredient_id: z.string(),
    category: z.enum(["model", "infrastructure", "tooling", "data_source", "framework"]),
    name: z.string(),
    maturity: z.enum(["research", "emerging", "production"]),
    accessibility: z.enum(["public_api", "open_source", "proprietary"]),
    tags: z.array(z.string()),
});
export type Ingredient = z.infer<typeof Ingredient>;

/**
 * A convergence hypothesis synthesized by the Explorer.
 * Represents a product/capability that could be built from existing ingredients
 * but hasn't been combined yet.
 * @see docs/explorer_agent.md §4 — The Convergence Detection Algorithm
 */
export const ConvergenceHypothesis = z.object({
    hypothesis_id: z.string(),
    title: z.string(),
    ingredients_combined: z.array(z.string()),
    synthesis: z.string(),
    disruption_target: z.string(),
    feasibility_score: z.number().int().min(1).max(10),
    novelty_score: z.number().int().min(1).max(10),
    why_incumbents_missed_it: z.string(),
});
export type ConvergenceHypothesis = z.infer<typeof ConvergenceHypothesis>;
