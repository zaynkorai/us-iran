/**
 * EnvironmentManager — The core execution engine.
 *
 * The orchestrator that manages state transitions, validates JSON schemas,
 * enforces agent permissions, sequences turns, and emits events for logging.
 *
 * @see docs/api_and_interfaces.md §1B — The EnvironmentManager
 * @see docs/engineering_implementation.md §6 — step(), runEpisode(), mountAgent()
 * @see docs/system_architecture.md §2 — The Execution Loop
 */
import { EventEmitter } from "events";
import type { GenericStateObject } from "../schemas/state.js";
import type { FrameworkConfig } from "../schemas/config.js";
import type { AgentPermissions } from "../schemas/meta.js";
import { ActionProposal } from "../schemas/actions.js";
import type { ActionProposal as ActionProposalType } from "../schemas/actions.js";
import type { TensionUpdate as TensionUpdateType } from "../schemas/actions.js";
import { NewAgentProvisioning } from "../schemas/meta.js";
import type { NewAgentProvisioning as NewAgentProvisioningType } from "../schemas/meta.js";
import { ActorAgent } from "../agents/actor.js";
import type { Capitalizer, ActionLogEntry } from "../agents/capitalizer.js";
import type { TensionDisruptor, InformationDisruptor } from "../agents/disruptor.js";
import {
    EpisodeCorruptedError,
    PermissionViolationError,
    MaxAgentsExceededError,
} from "../errors/index.js";

/** Supported events emitted by the EnvironmentManager. */
export interface EnvironmentEvents {
    "episode:start": [{ state: GenericStateObject }];
    "turn:complete": [{ speakerId: string; proposal: ActionProposalType }];
    "turn:penalty": [{ speakerId: string; retries: number }];
    "episode:complete": [{ finalState: GenericStateObject; reason: string }];
    "agent:created": [{ spec: NewAgentProvisioningType }];
}

export class EnvironmentManager extends EventEmitter {
    public state: GenericStateObject;
    public config: FrameworkConfig;

    /** The ordered sequence of agent IDs that take turns. */
    // Enforced by docs/system_architecture.md §4 — Turn Sequence Modification
    public turnOrder: string[] = [];

    /** Full action log for the current episode. */
    public actionLogs: ActionLogEntry[] = [];

    /** Reason the current episode terminated. */
    public terminationReason: string = "timeout";

    /** Tracks forced concession penalties per agent. */
    private penaltyCount: Record<string, number> = {};

    /** Whether the previous turn's proposal included propose_resolution. */
    // Enforced by docs/agent_design_and_state.md §4 — consecutive agreement
    private lastProposalWasFinal: boolean = false;

    /** Permission scopes for Provisioner-created agents. */
    // Enforced by docs/self_creation_mechanics.md §2 — Permissions Binding
    private agentPermissions: Record<string, AgentPermissions> = {};

    /** Set of agent IDs that were created by the Provisioner. */
    private createdAgentIds: Set<string> = new Set();

    /** Optional Capitalizer for strategic interjections. */
    private capitalizer?: Capitalizer;

    /** Optional tension disruptor. */
    private tensionAgent?: TensionDisruptor;

    /** Optional information disruptor. */
    private infoDisruptor?: InformationDisruptor;

    constructor(initialState: GenericStateObject, config: FrameworkConfig) {
        super();
        this.state = structuredClone(initialState);
        this.config = config;
    }

    /** Register a Capitalizer for strategic interjections. */
    setCapitalizer(capitalizer: Capitalizer): void {
        this.capitalizer = capitalizer;
    }

    /** Register a tension disruptor. */
    setTensionAgent(agent: TensionDisruptor): void {
        this.tensionAgent = agent;
    }

    /** Register an information disruptor. */
    setInfoDisruptor(agent: InformationDisruptor): void {
        this.infoDisruptor = agent;
    }

    /**
     * Execute a single tick of the execution loop.
     * Follows the strict 8-step sequence from the architecture docs.
     *
     * @see docs/engineering_implementation.md §6 — EnvironmentManager.step()
     * @see docs/system_architecture.md §2 — The Execution Loop
     */
    async step(agents: Record<string, ActorAgent>): Promise<number> {
        const speakerId = this.turnOrder[this.state.turn_number % this.turnOrder.length];
        const agent = agents[speakerId];
        if (!agent) throw new Error(`No agent mounted for speaker: ${speakerId}`);

        this.state.current_speaker_id = speakerId;

        // 1. Capitalizer interjection (if available)
        // Enforced by docs/system_architecture.md §2 — Step 2
        if (this.capitalizer) {
            const recentLogs = this.actionLogs.slice(-4);
            const hint = await this.capitalizer.analyzeOverlap(this.state, recentLogs);
            this.state.injections = { capitalizer_hint: hint.strategic_hint };
        }

        // 2. Build the Documented EnvironmentState Payload
        const environmentStatePayload = {
            turn_number: this.state.turn_number,
            max_turns: this.config.max_turns_per_episode,
            current_speaker_id: speakerId,
            public_transcript: this.actionLogs.map((log) => {
                if (log.speakerId === "disruptor_info") {
                    return { speaker: log.speakerId, text: log.headline };
                }
                return { speaker: log.speakerId, text: log.public_dialogue };
            }).filter(entry => entry.text !== undefined),
            proposed_state_object: this.state.variables,
            environmental_variables: {
                global_tension_level: this.state.variables.global_tension_level,
                ...this.state.variables
            },
            injections: this.state.injections
        };

        // 3. Agent proposes action (with validation retry loop)
        // Enforced by docs/api_and_interfaces.md §2 — Level 1: Validation Retry Loop
        let proposal: ActionProposalType | null = null;
        let turnTokenUsage = 0;
        let retries = 0;
        while (retries < this.config.max_validation_retries) {
            try {
                // Pass the enriched payload instead of the generic state
                const result = await agent.proposeAction(environmentStatePayload as unknown as GenericStateObject);
                turnTokenUsage += result.tokenUsage;
                proposal = ActionProposal.parse(result.proposal);
                break;
            } catch (err: unknown) {
                if (err && typeof err === "object" && "issues" in err) {

                    retries++;
                    const message = err instanceof Error ? err.message : String(err);
                    agent.appendRetryContext(message);
                } else {
                    throw err;
                }
            }
        }

        // 4. Fallback: forced concession penalty
        // Enforced by docs/api_and_interfaces.md §2 — Level 2 & 3
        if (!proposal) {
            this.penaltyCount[speakerId] = (this.penaltyCount[speakerId] ?? 0) + 1;
            if (this.penaltyCount[speakerId] >= this.config.forced_concession_threshold) {
                this.state.is_terminal = true;
                throw new EpisodeCorruptedError(speakerId);
            }
            this.emit("turn:penalty", { speakerId, retries });
            this.state.turn_number++;
            return turnTokenUsage; // Skip turn — opponent gains minor structural concession
        }

        // 5. Validate permissions (created agents have restricted field access)
        // Enforced by docs/self_creation_mechanics.md §2 — Permissions Binding
        for (const mutation of proposal.state_mutations) {
            if (!this.isPermitted(speakerId, mutation.path)) {
                throw new PermissionViolationError(speakerId, mutation.path);
            }
        }

        // 6. Apply state mutations
        for (const mutation of proposal.state_mutations) {
            this.applyMutation(mutation);
        }

        // 7. Check termination conditions
        // Enforced by docs/agent_design_and_state.md §4 — Disconnects and Finalization
        if (proposal.abort_episode) {
            this.state.is_terminal = true;
            this.terminationReason = "abort_episode";
        } else if (proposal.propose_resolution && this.lastProposalWasFinal) {
            // Consecutive agreement — both actors proposed resolution
            this.state.is_terminal = true;
            this.terminationReason = "agreement";
        }
        this.lastProposalWasFinal = proposal.propose_resolution;

        // 8. Log and emit
        const logEntry: ActionLogEntry = {
            turn: this.state.turn_number,
            speakerId,
            internal_monologue: proposal.internal_monologue,
            public_dialogue: proposal.public_dialogue,
            state_mutations: proposal.state_mutations,
            propose_resolution: proposal.propose_resolution,
            abort_episode: proposal.abort_episode,
        };
        this.actionLogs.push(logEntry);
        this.emit("turn:complete", { speakerId, proposal });

        // 9. Disruptor checks
        // Enforced by docs/system_architecture.md §2 — Steps 6-7
        if (this.tensionAgent) {
            const tension = await this.tensionAgent.observe(this.actionLogs, this.state);
            this.state.variables.global_tension_level = tension.new_tension_level;
        }
        if (
            this.infoDisruptor &&
            this.state.turn_number % this.config.info_disruptor_frequency === 0
        ) {
            const report = await this.infoDisruptor.observe(this.actionLogs, this.state);
            this.actionLogs.push({
                turn: this.state.turn_number,
                speakerId: "disruptor_info",
                ...report,
            });
        }

        this.state.turn_number++;
        return turnTokenUsage;
    }

    /**
     * Run a complete episode: loop step() until terminal or max_turns.
     *
     * @see docs/engineering_implementation.md §6 — EnvironmentManager.runEpisode()
     */
    async runEpisode(
        agents: Record<string, ActorAgent>,
    ): Promise<[GenericStateObject, ActionLogEntry[]]> {
        // Reset episode state
        this.state.is_terminal = false;
        this.state.turn_number = 0;
        this.actionLogs = [];
        this.terminationReason = "timeout";
        this.penaltyCount = {};
        this.lastProposalWasFinal = false;
        this.emit("episode:start", { state: structuredClone(this.state) });

        let tokenUsage = 0;

        while (
            !this.state.is_terminal &&
            this.state.turn_number < this.config.max_turns_per_episode
        ) {
            // Cost circuit breaker
            // Enforced by docs/safety_and_sandboxing.md §3 — Hard Token Limits
            if (tokenUsage > this.config.max_episode_tokens) {
                this.state.is_terminal = true;
                this.terminationReason = "token_limit";
                break;
            }

            try {
                tokenUsage += await this.step(agents);
            } catch (err) {
                if (err instanceof EpisodeCorruptedError) {
                    this.terminationReason = "corrupted";
                    break;
                }
                throw err;
            }

            // 10. Context Maintenance (Summarization)
            // Enforced by docs/system_architecture.md §2 — Step 9 (Context Maintenance)
            if (this.state.turn_number > 0 && this.state.turn_number % this.config.summarization_frequency === 0) {
                // Prune old action logs (keep only the last 2N turns to prevent context window explosion)
                const keepCount = this.config.summarization_frequency * 2;
                if (this.actionLogs.length > keepCount) {
                    this.actionLogs = this.actionLogs.slice(-keepCount);
                    // Emit an event so external loggers know the internal token context was pruned
                    this.emit("turn:penalty", { speakerId: "system_summarizer", retries: 0 }); // reuse or make new event
                }
            }
        }

        const finalState = structuredClone(this.state);
        this.emit("episode:complete", { finalState, reason: this.terminationReason });
        return [finalState, this.actionLogs];
    }

    /**
     * Validate and inject a Provisioner-designed agent into the live turn order.
     *
     * @see docs/engineering_implementation.md §6 — EnvironmentManager.mountAgent()
     * @see docs/system_architecture.md §4 — The Provisioner's Integration
     */
    mountAgent(spec: NewAgentProvisioningType, llmClient: import("../llm/client.js").LLMClient): ActorAgent {
        // 1. Schema validation
        const validated = NewAgentProvisioning.parse(spec);

        // 2. Enforce hard spawn cap
        // Enforced by docs/self_creation_mechanics.md §2 — Hard Limits
        const activeCreated = this.turnOrder.filter((id) => this.createdAgentIds.has(id));
        if (activeCreated.length >= this.config.max_active_created_agents) {
            throw new MaxAgentsExceededError(this.config.max_active_created_agents);
        }

        // 3. Instantiate the new ActorAgent
        // Created agents start with no mutable layer
        const newAgent = new ActorAgent({
            archetypeId: validated.agent_id,
            immutableCore: validated.system_prompt,
            mutableStrategy: "",
            llmClient,
        });

        // 4. Register permissions (enforced in step())
        this.agentPermissions[validated.agent_id] = validated.permissions;
        this.createdAgentIds.add(validated.agent_id);

        // 5. Extend turn order based on turn_injection_logic
        // e.g., "speak_every_3_turns" → insert after every 3rd existing slot
        const interval = this.parseTurnInjection(validated.turn_injection_logic);
        const newOrder: string[] = [];
        for (let i = 0; i < this.turnOrder.length; i++) {
            newOrder.push(this.turnOrder[i]);
            if ((i + 1) % interval === 0) newOrder.push(validated.agent_id);
        }
        this.turnOrder = newOrder;

        this.emit("agent:created", { spec: validated });
        return newAgent;
    }

    /**
     * Check if an agent is permitted to modify a given state path.
     * Primary actors have full access. Created agents are restricted.
     */
    private isPermitted(agentId: string, path: string): boolean {
        const perms = this.agentPermissions[agentId];
        if (!perms) return true; // Primary actors have no restrictions

        // Check explicit denials
        for (const denied of perms.cannot_modify_fields) {
            if (path.startsWith(denied)) return false;
        }

        // Check if path is in the allow list
        for (const allowed of perms.can_modify_fields) {
            if (path.startsWith(allowed)) return true;
        }

        // Default deny for created agents
        return false;
    }

    /**
     * Apply a single state mutation using dot-path notation.
     * @see docs/agent_design_and_state.md §2A — state_mutations
     */
    private applyMutation(mutation: { action: string; path: string; value: unknown }): void {
        const parts = mutation.path.split(".");
        let current: Record<string, unknown> = this.state.variables as Record<string, unknown>;

        for (let i = 0; i < parts.length - 1; i++) {
            const key = parts[i];
            if (!(key in current) || typeof current[key] !== "object") {
                if (mutation.action === "add") {
                    current[key] = {};
                } else {
                    return; // Can't modify a path that doesn't exist
                }
            }
            current = current[key] as Record<string, unknown>;
        }

        const finalKey = parts[parts.length - 1];
        current[finalKey] = structuredClone(mutation.value);
    }

    /**
     * Parse turn injection logic strings like "speak_every_3_turns".
     * Returns the interval number.
     */
    private parseTurnInjection(logic: string): number {
        const match = logic.match(/speak_every_(\d+)_turns/);
        if (match) return parseInt(match[1], 10);
        // Default: speak every turn
        return 1;
    }
}
