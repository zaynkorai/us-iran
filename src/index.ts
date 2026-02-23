/**
 * Self-Improving Framework — Public API
 *
 * A framework for building self-improving and self-creating LLM agents.
 *
 * @see README.md for documentation index
 */

// Core
export { EnvironmentManager } from "./core/index.js";
export { buildTriageContext, classifyStateFields, pruneMonologues } from "./core/index.js";

// Agents
export {
    ActorAgent,
    InformationDisruptor,
    TensionDisruptor,
    Capitalizer,
    Critic,
    Mutator,
    Provisioner,
    Explorer,
} from "./agents/index.js";

// Schemas
export {
    // State
    StateMutation,
    GenericStateObject,
    ConvergenceHypothesisSummary,
    // Actions
    ActionProposal,
    DisruptorReport,
    TensionUpdate,
    JudgeEvaluation,
    // Meta
    CapitalizerHint,
    MutationVariant,
    MutatorProposal,
    AgentPermissions,
    NewAgentProvisioning,
    // Explorer
    Ingredient,
    ConvergenceHypothesis,
    // Config
    FrameworkConfig,
} from "./schemas/index.js";

// Memory
export { SqliteDatabase, VectorMemory } from "./memory/index.js";

// LLM
export { LLMClient } from "./llm/index.js";
export { resolveLanguageModel } from "./llm/index.js";

// Errors
export {
    EpisodeCorruptedError,
    PermissionViolationError,
    MaxAgentsExceededError,
    UnsafeAgentDesignError,
    CostLimitExceededError,
} from "./errors/index.js";

// Orchestration
export { runFullSimulation } from "./orchestrator.js";
