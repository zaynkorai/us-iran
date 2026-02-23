import { describe, it, expect, vi } from "vitest";
import { runFullSimulation } from "../../orchestrator.js";
import { Critic } from "../../agents/critic.js";
import { Mutator } from "../../agents/mutator.js";
import { Provisioner } from "../../agents/provisioner.js";
import { ActorAgent } from "../../agents/actor.js";

const mockLLMClient = {
    model: {} as any,
    generateObject: vi.fn(),
    generateText: vi.fn(),
};

describe("Orchestrator - Multi-Actor Scalability", () => {
    it("handles 5 primary actors properly in parallel mutation execution", async () => {
        const actionProposalMock = {
            proposal: {
                internal_monologue: "Thinking...",
                public_dialogue: "Hello",
                state_mutations: [],
                propose_resolution: true,
                abort_episode: false,
            },
            tokenUsage: 100
        };

        const judgeEvaluationMock = {
            scores: { agent_0: 4, agent_1: 2, agent_2: 0, agent_3: -1, agent_4: 5 },
            rationales: { agent_0: "x", agent_1: "x", agent_2: "x", agent_3: "x", agent_4: "x" }
        };

        const mutatorProposalMock = {
            variants: [
                { variant_id: "v1", strategy_text: "mutated", hyperparameters: {} }
            ]
        };

        (mockLLMClient.generateObject as any).mockImplementation(async (schema: any, sys: any, prompt: any) => {
            // Distinguish Mutator calls via the prompt payload which includes mutation_count
            if (typeof prompt === "string" && prompt.includes("mutation_count")) {
                return { object: mutatorProposalMock };
            }
            return { object: actionProposalMock.proposal }; // Action proposals otherwise
        });

        const judge = new Critic("Test rubric", "Judge prompt", mockLLMClient as any);

        vi.spyOn(judge, "evaluate").mockResolvedValue(judgeEvaluationMock as any);

        const mutator = new Mutator("Mutator prompt", mockLLMClient as any);
        const provisioner = new Provisioner("Prov prompt", mockLLMClient as any);

        const agents: Record<string, ActorAgent> = {};
        for (let i = 0; i < 5; i++) {
            const id = `agent_${i}`;
            const agent = new ActorAgent({ archetypeId: id, immutableCore: "core", mutableStrategy: "strat", llmClient: mockLLMClient as any });
            vi.spyOn(agent, "proposeAction").mockResolvedValue(actionProposalMock as any);
            agents[id] = agent;
        }

        const config = {
            max_turns_per_episode: 2,
            epoch_size: 2,
            creation_patience: 10,
            max_validation_retries: 1,
            shadow_trial_count: 2,
            improvement_margin: 0.1,
            mutation_variants: 1,
            scout_sweep_interval_generations: 10
        } as any;

        let genCompletedCount = 0;

        await runFullSimulation({
            config,
            initialState: { turn_number: 0, current_speaker_id: "agent_0", is_terminal: false, variables: {} },
            agents,
            judge,
            mutator,
            provisioner,
            llmClient: mockLLMClient,
            maxGenerations: 1, // Only 1 generation for test
            onGenerationComplete: (gen, results) => {
                genCompletedCount++;
                expect(results.length).toBe(config.epoch_size);
                expect(Object.keys(results[0][1]).length).toBe(5); // 5 agents scored
            }
        });

        expect(genCompletedCount).toBe(1);
    });
});
