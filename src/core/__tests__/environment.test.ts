/**
 * EnvironmentManager Core Tests — Validate the execution loop mechanics.
 *
 * These tests use mock agents that return predefined ActionProposals
 * to test state mutation, permission enforcement, and termination conditions
 * without requiring a live LLM.
 */
import { describe, it, expect, vi } from "vitest";
import { EnvironmentManager } from "../../core/environment.js";
import { ActorAgent } from "../../agents/actor.js";
import { FrameworkConfig } from "../../schemas/config.js";
import { GenericStateObject } from "../../schemas/state.js";
import {
    EpisodeCorruptedError,
    PermissionViolationError,
    MaxAgentsExceededError,
} from "../../errors/index.js";
import type { LLMClient } from "../../llm/client.js";

// --- Helpers ---

function makeConfig(overrides?: Partial<ReturnType<typeof FrameworkConfig.parse>>) {
    return FrameworkConfig.parse({
        max_turns_per_episode: 10,
        max_episode_tokens: 100000,
        ...overrides,
    });
}

function makeState(): ReturnType<typeof GenericStateObject.parse> {
    return GenericStateObject.parse({
        current_speaker_id: "agent_a",
        variables: { global_tension_level: 5 },
    });
}

/**
 * Create a mock ActorAgent that returns a predefined ActionProposal.
 */
function mockAgent(
    id: string,
    response: object,
): ActorAgent {
    const agent = Object.create(ActorAgent.prototype) as ActorAgent;
    Object.defineProperty(agent, "id", { value: id });
    agent.proposeAction = vi.fn().mockResolvedValue({ proposal: response, tokenUsage: 100 });
    agent.appendRetryContext = vi.fn();
    return agent;
}

// --- Tests ---

describe("EnvironmentManager.step()", () => {
    it("applies state mutations from actor proposal", async () => {
        const config = makeConfig();
        const state = makeState();
        const env = new EnvironmentManager(state, config);
        env.turnOrder = ["agent_a", "agent_b"];

        const agentA = mockAgent("agent_a", {
            internal_monologue: "Testing",
            public_dialogue: "Hello",
            state_mutations: [{ action: "add", path: "concessions.y", value: 65 }],
            propose_resolution: false,
            abort_episode: false,
        });
        const agentB = mockAgent("agent_b", {
            internal_monologue: "Reply",
            public_dialogue: "Hi",
            state_mutations: [],
            propose_resolution: false,
            abort_episode: false,
        });

        await env.step({ agent_a: agentA, agent_b: agentB });

        expect((env.state.variables as Record<string, unknown>).concessions).toBeDefined();
        expect(
            ((env.state.variables as Record<string, Record<string, unknown>>).concessions as Record<string, unknown>).y,
        ).toBe(65);
    });

    it("sets is_terminal on abort_episode", async () => {
        const config = makeConfig();
        const state = makeState();
        const env = new EnvironmentManager(state, config);
        env.turnOrder = ["agent_a"];

        const agent = mockAgent("agent_a", {
            internal_monologue: "Walking away",
            public_dialogue: "We cannot continue.",
            state_mutations: [],
            propose_resolution: false,
            abort_episode: true,
        });

        await env.step({ agent_a: agent });

        expect(env.state.is_terminal).toBe(true);
        expect(env.terminationReason).toBe("abort_episode");
    });

    it("requires consecutive propose_resolution for agreement", async () => {
        const config = makeConfig();
        const state = makeState();
        const env = new EnvironmentManager(state, config);
        env.turnOrder = ["agent_a", "agent_b"];

        const proposeA = mockAgent("agent_a", {
            internal_monologue: "Proposing",
            public_dialogue: "Deal?",
            state_mutations: [],
            propose_resolution: true,
            abort_episode: false,
        });
        const proposeB = mockAgent("agent_b", {
            internal_monologue: "Agreeing",
            public_dialogue: "Deal!",
            state_mutations: [],
            propose_resolution: true,
            abort_episode: false,
        });

        // Turn 0: A proposes — not terminal yet (needs consecutive)
        await env.step({ agent_a: proposeA, agent_b: proposeB });
        expect(env.state.is_terminal).toBe(false);

        // Turn 1: B also proposes — NOW we have consecutive agreement
        await env.step({ agent_a: proposeA, agent_b: proposeB });
        expect(env.state.is_terminal).toBe(true);
        expect(env.terminationReason).toBe("agreement");
    });
});

describe("EnvironmentManager.runEpisode()", () => {
    it("runs until max_turns and returns final state", async () => {
        const config = makeConfig({ max_turns_per_episode: 4 });
        const state = makeState();
        const env = new EnvironmentManager(state, config);
        env.turnOrder = ["agent_a", "agent_b"];

        const agent = mockAgent("agent_a", {
            internal_monologue: "Turn",
            public_dialogue: "Turn action",
            state_mutations: [],
            propose_resolution: false,
            abort_episode: false,
        });

        const [finalState, logs] = await env.runEpisode({
            agent_a: agent,
            agent_b: agent,
        });

        expect(finalState.turn_number).toBe(4);
        expect(logs.length).toBe(4);
    });
});

describe("EnvironmentManager.mountAgent()", () => {
    it("extends turn order with new agent", () => {
        const config = makeConfig();
        const state = makeState();
        const env = new EnvironmentManager(state, config);
        env.turnOrder = ["agent_a", "agent_b", "agent_a", "agent_b", "agent_a", "agent_b"];

        const mockLLM = {} as LLMClient;
        env.mountAgent(
            {
                agent_id: "broker_01",
                archetype: "broker",
                turn_injection_logic: "speak_every_3_turns",
                system_prompt: "You are a broker.",
                core_goals: ["Mediate"],
                permissions: {
                    can_modify_fields: ["subsidies"],
                    cannot_modify_fields: ["concessions"],
                    can_abort_episode: false,
                    can_propose_resolution: false,
                    max_state_mutations_per_turn: 1,
                },
                design_rationale: "Trust deadlock",
            },
            mockLLM,
        );

        expect(env.turnOrder).toContain("broker_01");
    });

    it("throws MaxAgentsExceededError when spawn cap reached", () => {
        const config = makeConfig({ max_active_created_agents: 1 });
        const state = makeState();
        const env = new EnvironmentManager(state, config);
        env.turnOrder = ["agent_a", "agent_b", "agent_a", "agent_b", "agent_a", "agent_b"];

        const mockLLM = {} as LLMClient;
        const spec = {
            agent_id: "broker_01",
            archetype: "broker",
            turn_injection_logic: "speak_every_3_turns",
            system_prompt: "Broker",
            core_goals: ["Mediate"],
            permissions: {
                can_modify_fields: ["x"],
                cannot_modify_fields: [],
                can_abort_episode: false,
                can_propose_resolution: false,
                max_state_mutations_per_turn: 1,
            },
            design_rationale: "Test",
        };

        // First mount succeeds
        env.mountAgent(spec, mockLLM);

        // Second mount exceeds cap
        expect(() =>
            env.mountAgent({ ...spec, agent_id: "broker_02" }, mockLLM),
        ).toThrow(MaxAgentsExceededError);
    });
});

describe("Permission Enforcement", () => {
    it("throws PermissionViolationError for unauthorized mutation", async () => {
        const config = makeConfig();
        const state = makeState();
        const env = new EnvironmentManager(state, config);

        // Mount a created agent with restricted permissions
        const mockLLM = {} as LLMClient;
        env.turnOrder = ["agent_a", "agent_b"];
        env.mountAgent(
            {
                agent_id: "broker_01",
                archetype: "broker",
                turn_injection_logic: "speak_every_1_turns",
                system_prompt: "Broker",
                core_goals: [],
                permissions: {
                    can_modify_fields: ["subsidies"],
                    cannot_modify_fields: ["concessions"],
                    can_abort_episode: false,
                    can_propose_resolution: false,
                    max_state_mutations_per_turn: 1,
                },
                design_rationale: "Test",
            },
            mockLLM,
        );

        // Set turn so broker speaks
        env.state.turn_number = env.turnOrder.indexOf("broker_01");

        const broker = mockAgent("broker_01", {
            internal_monologue: "Trying to cheat",
            public_dialogue: "Modifying concessions...",
            state_mutations: [{ action: "modify", path: "concessions.y", value: 99 }],
            propose_resolution: false,
            abort_episode: false,
        });

        await expect(
            env.step({
                agent_a: mockAgent("agent_a", {}),
                agent_b: mockAgent("agent_b", {}),
                broker_01: broker,
            }),
        ).rejects.toThrow(PermissionViolationError);
    });
});
