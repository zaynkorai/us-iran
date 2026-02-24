/**
 * Explorer — The Possibility Researcher agent.
 *
 * Scans an Ingredient Graph of available technologies and synthesizes
 * convergence hypotheses — products/capabilities that could be built today
 * from existing ingredients but haven't been combined yet.
 *
 * @see docs/api_and_interfaces.md §1H — The Explorer
 * @see docs/explorer_agent.md — Full design
 */
import type { LLMClient } from "../llm/client.js";
import { Ingredient, ConvergenceHypothesis } from "../schemas/explorer.js";
import type {
    Ingredient as IngredientType,
    ConvergenceHypothesis as ConvergenceHypothesisType,
} from "../schemas/explorer.js";
import { z } from "zod/v4";

/** Schema for the Explorer's batch scan output. */
const ExplorerScanOutput = z.object({
    hypotheses: z.array(ConvergenceHypothesis),
});

export class Explorer {
    public ingredients: IngredientType[];
    private systemPrompt: string;
    private llmClient: LLMClient;

    constructor(
        ingredientGraph: IngredientType[],
        systemPrompt: string,
        llmClient: LLMClient,
    ) {
        this.ingredients = ingredientGraph;
        this.systemPrompt = systemPrompt;
        this.llmClient = llmClient;
    }

    /**
     * Run convergence detection across the ingredient graph.
     * Identifies n-wise combinations of ingredients that could form novel products.
     *
     * @see docs/explorer_agent.md §4 — The Convergence Detection Algorithm
     */
    async scan(): Promise<ConvergenceHypothesisType[]> {
        const prompt = JSON.stringify({
            available_ingredients: this.ingredients,
            task: "Analyze these ingredients and identify novel products or capabilities that could be built by combining them but do NOT currently exist on the market.",
        });

        try {
            const result = await this.llmClient.generateObject(
                ExplorerScanOutput,
                this.systemPrompt,
                prompt,
                // Higher temperature for creative hypothesis generation
                { temperature: 0.9 },
            );
            return result.object.hypotheses;
        } catch (error) {
            console.warn("Explorer failed to generate hypothesis. Using local fallback.", error);
            // Deterministic local fallback
            return [{
                hypothesis_id: `hyp_fallback_${Date.now()}`,
                title: "Fallback Convergence",
                ingredients_combined: this.ingredients.length > 0 ? [this.ingredients[0].ingredient_id] : [],
                synthesis: "A generic capability built from available parts.",
                disruption_target: "General Market",
                feasibility_score: 5,
                novelty_score: 5,
                why_incumbents_missed_it: "Deterministic local fallback triggered due to LLM failure.",
                estimated_time_to_market: "Unknown"
            }];
        }
    }

    /**
     * Add a new ingredient to the graph.
     * May trigger an Explorer scan if scout_on_new_ingredient is enabled.
     *
     * @see docs/explorer_agent.md §6 — Scheduling Triggers (Event-driven)
     */
    ingestIngredient(ingredient: IngredientType): void {
        // Validate the ingredient schema before adding
        // Enforced by docs/safety_and_sandboxing.md §2A — Strict Schema Validation
        Ingredient.parse(ingredient);
        this.ingredients.push(ingredient);
    }
}
