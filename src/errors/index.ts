/**
 * Custom Error Classes — Framework-specific errors for deterministic error handling.
 * @see docs/api_and_interfaces.md §2 — Error Handling & Fallbacks
 * @see docs/safety_and_sandboxing.md §3 — Resource and Cost Limits
 */

/**
 * Thrown when an agent accumulates too many forced concession penalties
 * (failed Zod validation retries). The episode is considered corrupted.
 * Both agents receive a -5 score.
 * @see docs/api_and_interfaces.md §2 — Level 3: Ultimate Episode Termination
 */
export class EpisodeCorruptedError extends Error {
    public readonly agentId: string;

    constructor(agentId: string) {
        super(`Episode corrupted: Agent "${agentId}" exceeded forced concession threshold.`);
        this.name = "EpisodeCorruptedError";
        this.agentId = agentId;
    }
}

/**
 * Thrown when an agent attempts to modify a state field it does not have
 * permission to touch.
 * @see docs/self_creation_mechanics.md §2 — Phase 4: Permissions Binding
 */
export class PermissionViolationError extends Error {
    public readonly agentId: string;
    public readonly path: string;

    constructor(agentId: string, path: string) {
        super(`Permission violation: Agent "${agentId}" attempted to modify restricted path "${path}".`);
        this.name = "PermissionViolationError";
        this.agentId = agentId;
        this.path = path;
    }
}

/**
 * Thrown when the Provisioner attempts to spawn more agents than
 * the configured max_active_created_agents cap.
 * @see docs/self_creation_mechanics.md §2 — Hard Limits on Agent Spawning
 */
export class MaxAgentsExceededError extends Error {
    public readonly maxAllowed: number;

    constructor(maxAllowed: number) {
        super(`Maximum created agents exceeded: Hard cap is ${maxAllowed}.`);
        this.name = "MaxAgentsExceededError";
        this.maxAllowed = maxAllowed;
    }
}

/**
 * Thrown when a Provisioner-designed agent has game-breaking capabilities
 * (e.g., can_abort_episode or can_propose_resolution).
 * @see docs/engineering_implementation.md §6 — Provisioner.designAgent() safety guardrails
 */
export class UnsafeAgentDesignError extends Error {
    constructor(reason: string) {
        super(`Unsafe agent design rejected: ${reason}`);
        this.name = "UnsafeAgentDesignError";
    }
}

/**
 * Thrown when an episode exceeds the configured max_episode_tokens limit.
 * @see docs/safety_and_sandboxing.md §3 — Hard Token Limits
 */
export class CostLimitExceededError extends Error {
    public readonly tokensUsed: number;
    public readonly tokenLimit: number;

    constructor(tokensUsed: number, tokenLimit: number) {
        super(`Cost limit exceeded: Used ${tokensUsed} tokens (limit: ${tokenLimit}).`);
        this.name = "CostLimitExceededError";
        this.tokensUsed = tokensUsed;
        this.tokenLimit = tokenLimit;
    }
}
