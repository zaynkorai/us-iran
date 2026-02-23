/**
 * Schema barrel export — all Zod schemas and inferred types.
 */

// State
export { StateMutation, ConvergenceHypothesisSummary, GenericStateObject } from "./state.js";
export type { StateMutation as StateMutationType, GenericStateObject as GenericStateObjectType } from "./state.js";

// Actions
export { ActionProposal, DisruptorReport, TensionUpdate, JudgeEvaluation } from "./actions.js";

// Meta-Agent schemas
export {
    CapitalizerHint,
    MutationVariant,
    MutatorProposal,
    AgentPermissions,
    NewAgentProvisioning,
} from "./meta.js";

// Explorer schemas
export { Ingredient, ConvergenceHypothesis } from "./explorer.js";

// Configuration
export { FrameworkConfig } from "./config.js";
