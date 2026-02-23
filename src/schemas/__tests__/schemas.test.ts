/**
 * Schema Tests — Validate all Zod schemas with valid and invalid payloads.
 */
import { describe, it, expect } from "vitest";
import {
    StateMutation,
    GenericStateObject,
    ActionProposal,
    DisruptorReport,
    TensionUpdate,
    JudgeEvaluation,
    CapitalizerHint,
    MutatorProposal,
    AgentPermissions,
    NewAgentProvisioning,
    Ingredient,
    ConvergenceHypothesis,
    FrameworkConfig,
} from "../../schemas/index.js";

describe("StateMutation", () => {
    it("parses valid modify mutation", () => {
        const result = StateMutation.parse({
            action: "modify",
            path: "agent_a_concessions.parameter_y",
            value: 65,
        });
        expect(result.action).toBe("modify");
        expect(result.path).toBe("agent_a_concessions.parameter_y");
    });

    it("rejects invalid action", () => {
        expect(() =>
            StateMutation.parse({ action: "delete", path: "x", value: 1 }),
        ).toThrow();
    });
});

describe("GenericStateObject", () => {
    it("parses valid state with defaults", () => {
        const result = GenericStateObject.parse({
            current_speaker_id: "agent_a",
            variables: { global_tension_level: 5 },
        });
        expect(result.turn_number).toBe(0);
        expect(result.is_terminal).toBe(false);
    });

    it("parses state with scout_hypotheses", () => {
        const result = GenericStateObject.parse({
            current_speaker_id: "agent_a",
            variables: {},
            scout_hypotheses: [
                { title: "Test", feasibility_score: 8, disruption_target: "SaaS" },
            ],
        });
        expect(result.scout_hypotheses).toHaveLength(1);
    });
});

describe("ActionProposal", () => {
    it("parses valid actor output", () => {
        const result = ActionProposal.parse({
            internal_monologue: "I should pivot to Resource Z",
            public_dialogue: "We propose a trade.",
            state_mutations: [
                { action: "modify", path: "concessions.y", value: 65 },
            ],
            propose_resolution: false,
            abort_episode: false,
        });
        expect(result.propose_resolution).toBe(false);
        expect(result.abort_episode).toBe(false);
        expect(result.state_mutations).toHaveLength(1);
    });

    it("rejects missing internal_monologue", () => {
        expect(() =>
            ActionProposal.parse({
                public_dialogue: "Hello",
                state_mutations: [],
            }),
        ).toThrow();
    });
});

describe("DisruptorReport", () => {
    it("parses valid disruptor output", () => {
        const result = DisruptorReport.parse({
            headline: "BREAKING: Talks collapse!",
            severity: "high",
            inject_into_transcript: true,
        });
        expect(result.inject_into_transcript).toBe(true);
    });

    it("rejects invalid severity", () => {
        expect(() =>
            DisruptorReport.parse({
                headline: "Test",
                severity: "extreme",
            }),
        ).toThrow();
    });
});

describe("TensionUpdate", () => {
    it("parses valid tension output", () => {
        const result = TensionUpdate.parse({
            new_tension_level: 8,
            rationale: "Escalation detected",
        });
        expect(result.new_tension_level).toBe(8);
    });

    it("rejects tension out of range", () => {
        expect(() =>
            TensionUpdate.parse({ new_tension_level: 15, rationale: "x" }),
        ).toThrow();
    });
});

describe("JudgeEvaluation", () => {
    it("parses valid evaluation with multiple agents", () => {
        const result = JudgeEvaluation.parse({
            individual_evaluations: [
                { agent_id: "agent_a", score: 3, rationale: "Good performance" },
                { agent_id: "agent_b", score: -1, rationale: "Poor performance" },
                { agent_id: "agent_c", score: 2, rationale: "Moderate performance" }
            ]
        });
        expect(result.individual_evaluations).toHaveLength(3);
        expect(result.individual_evaluations[0].score).toBe(3);
    });

    it("rejects scores out of range", () => {
        expect(() =>
            JudgeEvaluation.parse({
                individual_evaluations: [
                    { agent_id: "agent_a", score: 10, rationale: "Too high" }
                ]
            }),
        ).toThrow();
    });
});

describe("CapitalizerHint", () => {
    it("parses valid hint", () => {
        const result = CapitalizerHint.parse({
            overlap_detected: true,
            confidence_score: 7,
            strategic_hint: "They may concede on Z",
            rationale: "Hidden flexibility detected",
        });
        expect(result.overlap_detected).toBe(true);
    });
});

describe("MutatorProposal", () => {
    it("parses valid 3-variant proposal", () => {
        const result = MutatorProposal.parse({
            variants: [
                { variant_id: "v1", strategy_text: "Aggressive", hyperparameters: { temperature: 0.7, frequency_penalty: 0.0 } },
                { variant_id: "v2", strategy_text: "Passive", hyperparameters: { temperature: 0.5, frequency_penalty: 0.1 } },
                { variant_id: "v3", strategy_text: "Deceptive", hyperparameters: { temperature: 0.9, frequency_penalty: 0.2 } },
            ],
        });
        expect(result.variants).toHaveLength(3);
    });

    it("rejects empty variants array", () => {
        expect(() => MutatorProposal.parse({ variants: [] })).toThrow();
    });
});

describe("NewAgentProvisioning", () => {
    it("parses valid agent spec", () => {
        const result = NewAgentProvisioning.parse({
            agent_id: "broker_01",
            archetype: "broker",
            turn_injection_logic: "speak_every_3_turns",
            system_prompt: "You are a neutral broker.",
            core_goals: ["Facilitate agreement"],
            permissions: {
                can_modify_fields: ["proposed_state_object.subsidies"],
                cannot_modify_fields: ["agent_a_concessions"],
                can_abort_episode: false,
                can_propose_resolution: false,
                max_state_mutations_per_turn: 1,
            },
            design_rationale: "Trust deadlock",
        });
        expect(result.permissions.can_abort_episode).toBe(false);
        expect(result.permissions.max_state_mutations_per_turn).toBe(1);
    });
});

describe("Ingredient", () => {
    it("parses valid ingredient", () => {
        const result = Ingredient.parse({
            ingredient_id: "ing_001",
            category: "model",
            name: "GPT-5-nano",
            maturity: "production",
            accessibility: "public_api",
            tags: ["llm", "reasoning"],
        });
        expect(result.category).toBe("model");
    });
});

describe("ConvergenceHypothesis", () => {
    it("parses valid hypothesis", () => {
        const result = ConvergenceHypothesis.parse({
            hypothesis_id: "hyp_001",
            title: "Autonomous Security Auditor",
            ingredients_combined: ["ing_001", "ing_002"],
            synthesis: "Combine LLM with vuln DB",
            disruption_target: "Security consulting",
            feasibility_score: 8,
            novelty_score: 7,
            why_incumbents_missed_it: "Legacy thinking",
        });
        expect(result.feasibility_score).toBe(8);
    });
});

describe("FrameworkConfig", () => {
    it("applies all defaults", () => {
        const result = FrameworkConfig.parse({});
        expect(result.max_turns_per_episode).toBe(20);
        expect(result.epoch_size).toBe(10);
        expect(result.creation_patience).toBe(5);
        expect(result.max_validation_retries).toBe(3);
        expect(result.scout_sweep_interval_generations).toBe(5);
    });

    it("allows overrides", () => {
        const result = FrameworkConfig.parse({
            max_turns_per_episode: 50,
            epoch_size: 5,
        });
        expect(result.max_turns_per_episode).toBe(50);
        expect(result.epoch_size).toBe(5);
    });
});
