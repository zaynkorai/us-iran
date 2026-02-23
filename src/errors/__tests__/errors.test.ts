/**
 * Error Class Tests — Validate custom error classes.
 */
import { describe, it, expect } from "vitest";
import {
    EpisodeCorruptedError,
    PermissionViolationError,
    MaxAgentsExceededError,
    UnsafeAgentDesignError,
    CostLimitExceededError,
} from "../../errors/index.js";

describe("EpisodeCorruptedError", () => {
    it("is an instance of Error", () => {
        const err = new EpisodeCorruptedError("agent_a");
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe("EpisodeCorruptedError");
        expect(err.agentId).toBe("agent_a");
        expect(err.message).toContain("agent_a");
    });
});

describe("PermissionViolationError", () => {
    it("contains agent and path context", () => {
        const err = new PermissionViolationError("broker_01", "agent_a_concessions.y");
        expect(err).toBeInstanceOf(Error);
        expect(err.agentId).toBe("broker_01");
        expect(err.path).toBe("agent_a_concessions.y");
    });
});

describe("MaxAgentsExceededError", () => {
    it("contains the max cap", () => {
        const err = new MaxAgentsExceededError(3);
        expect(err.maxAllowed).toBe(3);
        expect(err.message).toContain("3");
    });
});

describe("UnsafeAgentDesignError", () => {
    it("contains the rejection reason", () => {
        const err = new UnsafeAgentDesignError("cannot trigger abort_episode");
        expect(err.message).toContain("abort_episode");
    });
});

describe("CostLimitExceededError", () => {
    it("tracks usage details", () => {
        const err = new CostLimitExceededError(60000, 50000);
        expect(err.tokensUsed).toBe(60000);
        expect(err.tokenLimit).toBe(50000);
    });
});
