# Engineering Implementation (Core Library Architecture)

To ensure this framework is portable, and easily adaptable to other use cases, it is designed as a clean, TypeScript Library rather than a complex cluster of microservices.

Anyone can `npm install` the framework and run it locally with minimal infrastructure overhead, while still benefiting from state of the art asynchronous execution.

## 1. The Architectural Paradigm

The framework uses standard asynchronous TypeScript (`async/await` with Promises) to manage concurrency. It relies on a central `EnvironmentManager` class that acts as the orchestrator, passing a strictly-typed `StateObject` between independent `Agent` classes.

### Why a Native TypeScript Library?

1. Simplicity (KISS) no need to spin up Redis, Kafka, or Docker swarms just to run a negotiation simulation.
2. The entire framework is portable can run on a single laptop or a single cloud VM via Node.js.
3. In-memory state passing via native JavaScript objects is vastly faster than serializing/deserializing JSON payloads over a network bus for every turn.

## 2. Core Class Interactions

The framework is divided into distinct, cleanly separated TypeScript classes covering every agent type defined in the architecture:

* **`EnvironmentManager`**: The core loop. It holds the gold-standard copy of the `GenericStateObject`. It sequences turns (e.g., calling `await agentA.proposeAction(currentState)`), enforces constraints, validates permissions, and emits events for logging.
* **`ActorAgent`**: A stateless TypeScript wrapper around an LLM provider (e.g., using the OpenAI or Anthropic SDK). It receives the current state, generates its `InternalMonologue` and `ActionProposal`, and returns them to the Manager.
* **`DisruptorAgent`**: A specialized agent class for Information and Tension disruptors. It observes the transcript and returns its specific output schema (headlines or tension levels).
* **`Critic` (Judge)**: An asynchronous evaluator class called by the `EnvironmentManager` when an episode terminates. It returns a scored mathematical evaluation of the final state.
* **`Mutator`**: A batch-processing class. Once an epoch (e.g., 10 episodes) finishes, the main script calls the Mutator, passing in the logs. The Mutator queries local memory, generates new prompts, and instantiates *new instances* of `ActorAgent` for the next epoch.
* **`Provisioner`**: The self-creation engine. Triggered when the Mutator has failed to improve scores for $K$ consecutive generations (see `self_creation_mechanics.md`). It designs a complete new agent specification and outputs a `NewAgentProvisioning` schema. The `EnvironmentManager` validates, shadow-tests, and optionally mounts the new agent.
* **`Explorer`**: The possibility research engine. Scans an `IngredientGraph` of available technologies and synthesizes convergence hypotheses. Its output is injected into the `EnvironmentState` for the Primary Actors to debate, and the existing Judge/Mutator pipeline evolves the Explorer over time. See `explorer_agent.md`.

## 3. The Object Models (Zod)

Communication across the framework relies strictly on Zod schemas to guarantee that LLM hallucinations cannot break the system state. Zod provides runtime type validation with full TypeScript type inference.

### `ActionProposal` Output Schema

When an Actor takes a turn, it must return this exact Zod-validated format. The `EnvironmentManager` parses this object to update the global state.

```typescript
import { z } from "zod";

const StateMutation = z.object({
  action: z.enum(["modify", "add"]),
  path: z.string().describe("The generic path in the state object to modify"),
  value: z.any().describe("The new value"),
});

const ActionProposal = z.object({
  internal_monologue: z.string().describe("Your hidden reasoning."),
  public_dialogue: z.string().describe("What you explicitly say to the other agent."),
  state_mutations: z.array(StateMutation).describe("Proposed changes to the state."),
  propose_resolution: z.boolean().default(false),
  abort_episode: z.boolean().default(false),
});

type ActionProposal = z.infer<typeof ActionProposal>;
```

### `NewAgentProvisioning` Schema

When the Provisioner designs a new agent, it must return this exact Zod-validated format.

```typescript
const AgentPermissions = z.object({
  can_modify_fields: z.array(z.string()).describe("State object paths this agent can modify"),
  cannot_modify_fields: z.array(z.string()).describe("State object paths explicitly denied"),
  can_abort_episode: z.boolean().default(false),
  can_propose_resolution: z.boolean().default(false),
  max_state_mutations_per_turn: z.number().int().default(1),
});

const NewAgentProvisioning = z.object({
  agent_id: z.string().describe("A unique identifier for the new agent"),
  archetype: z.string().describe("e.g., 'broker', 'validator', 'proxy_actor', 'disruptor'"),
  turn_injection_logic: z.string().describe("e.g., 'speak_every_3_turns'"),
  system_prompt: z.string().describe("The complete Layer 1 immutable core prompt"),
  core_goals: z.array(z.string()),
  permissions: AgentPermissions,
  design_rationale: z.string().describe("Why this agent breaks the deadlock"),
});

type NewAgentProvisioning = z.infer<typeof NewAgentProvisioning>;
```

## 4. Configuration

The framework exposes a single configuration object to control all tunable parameters:

```typescript
const FrameworkConfig = z.object({
  // Episode Limits
  max_turns_per_episode: z.number().int().default(20),
  max_episode_tokens: z.number().int().default(50000),

  // Mutation Settings
  epoch_size: z.number().int().default(10),        // episodes per epoch
  mutation_variants: z.number().int().default(3),   // strategies generated per mutation cycle
  shadow_trial_count: z.number().int().default(10), // episodes per shadow trial
  improvement_margin: z.number().default(0.5),      // delta required for acceptance

  // Creation Settings
  creation_patience: z.number().int().default(5),   // K generations of plateau before triggering Provisioner
  max_active_created_agents: z.number().int().default(3),
  creation_cooldown_generations: z.number().int().default(3),
  require_human_approval_for_creation: z.boolean().default(true),

  // Error Handling
  max_validation_retries: z.number().int().default(3),
  forced_concession_threshold: z.number().int().default(2), // penalties before episode termination
});

type FrameworkConfig = z.infer<typeof FrameworkConfig>;
```

## 5. Example Execution Script

The entire framework can be run with a simple execution block in a single file:

```typescript
import { EnvironmentManager, ActorAgent, Critic, Mutator, Provisioner } from "./framework";
import { FrameworkConfig } from "./schemas";

async function runFullSimulation() {
  const config = FrameworkConfig.parse({
    max_turns_per_episode: 20,
    epoch_size: 10,
  });

  let agentA = new ActorAgent({
    archetypeId: "agent_a",
    immutableCore: "You are Agent Alpha. Your absolute goal is to maximize resources.",
    mutableStrategy: "Utilize a balanced opening posture.",
  });
  let agentB = new ActorAgent({
    archetypeId: "agent_b",
    immutableCore: "You are Agent Beta. Your absolute goal is stability and compromise.",
    mutableStrategy: "Seek early concessions on secondary parameters.",
  });
  const agents: Record<string, ActorAgent> = { agent_a: agentA, agent_b: agentB };
  const env = new EnvironmentManager(DEFAULT_STATE, config);
  const judge = new Critic(SCORING_RUBRIC);
  const mutator = new Mutator();
  const creator = new Provisioner();

  for (let generation = 0; generation < 100; generation++) {
    // Phase 1: Run an Epoch
    const epochResults: Array<[GenericStateObject, number, number]> = [];
    for (let i = 0; i < config.epoch_size; i++) {
      const initialState = structuredClone(env.state);
      const [finalState, transcript] = await env.runEpisode(agents);
      const [scoreA, scoreB] = await judge.evaluate(initialState, finalState, transcript);
      epochResults.push([finalState, scoreA, scoreB]);
    }

    // Phase 2: Self-Improvement (Mutate)
    const newAgentA = await mutator.evolve(agentA, epochResults, config);
    if (newAgentA) {
      agentA = newAgentA;
      agents.agent_a = agentA;
      continue; // Mutation succeeded; skip creation
    }

    // Phase 3: Self-Creation (if plateau detected)
    if (mutator.isPlateaued(config.creation_patience)) {
      const newAgentSpec = await creator.designAgent(env.state, epochResults);
      if (config.require_human_approval_for_creation) {
        console.log(`Provisioner proposes: ${newAgentSpec.agent_id} (${newAgentSpec.archetype})`);
        const answer = await prompt("Deploy? [y/N]: ");
        if (answer?.toLowerCase() !== "y") continue;
      }
      const newAgent = env.mountAgent(newAgentSpec);
      agents[newAgentSpec.agent_id] = newAgent;
    }
  }
}

runFullSimulation();
```

## 6. Complete Method Body Pseudocode

The following provides the full algorithmic logic for every `{ ... }` stub referenced above.

### `EnvironmentManager.step()`

Executes a single tick of the execution loop (see `system_architecture.md` §2).

```typescript
async step(agents: Record<string, ActorAgent>): Promise<void> {
  const speakerId = this.turnOrder[this.state.turn_number % this.turnOrder.length];
  const agent = agents[speakerId];
  if (!agent) throw new Error(`No agent mounted for speaker: ${speakerId}`);

  this.state.current_speaker_id = speakerId;

  // 1. Capitalizer interjection (if available)
  if (this.capitalizer) {
    const recentLogs = this.actionLogs.slice(-4);
    const hint = await this.capitalizer.analyzeOverlap(this.state, recentLogs);
    this.state.injections = { capitalizer_hint: hint.strategic_hint };
  }

  // 2. Agent proposes action (with validation retry loop)
  let proposal: ActionProposal | null = null;
  let retries = 0;
  while (retries < this.config.max_validation_retries) {
    try {
      const raw = await agent.proposeAction(this.state);
      proposal = ActionProposal.parse(raw); // Zod validation
      break;
    } catch (err) {
      if (err instanceof ZodError) {
        retries++;
        agent.appendRetryContext(err.message); // Re-prompt with error
      } else throw err;
    }
  }

  // 3. Fallback: forced concession penalty
  if (!proposal) {
    this.penaltyCount[speakerId] = (this.penaltyCount[speakerId] ?? 0) + 1;
    if (this.penaltyCount[speakerId] >= this.config.forced_concession_threshold) {
      this.state.is_terminal = true;
      throw new EpisodeCorruptedError(speakerId);
    }
    this.emit("turn:penalty", { speakerId, retries });
    this.state.turn_number++;
    return; // Skip turn — opponent gains minor structural concession
  }

  // 4. Validate permissions (created agents have restricted field access)
  for (const mutation of proposal.state_mutations) {
    if (!this.isPermitted(speakerId, mutation.path)) {
      throw new PermissionViolationError(speakerId, mutation.path);
    }
  }

  // 5. Apply state mutations
  for (const mutation of proposal.state_mutations) {
    this.applyMutation(mutation);
  }

  // 6. Check termination conditions
  if (proposal.abort_episode) {
    this.state.is_terminal = true;
    this.terminationReason = "abort_episode";
  } else if (proposal.propose_resolution && this.lastProposalWasFinal) {
    this.state.is_terminal = true;
    this.terminationReason = "agreement";
  }
  this.lastProposalWasFinal = proposal.propose_resolution;

  // 7. Log and emit
  this.actionLogs.push({ turn: this.state.turn_number, speakerId, ...proposal });
  this.emit("turn:complete", { speakerId, proposal });

  // 8. Disruptor checks (tension + information every N turns)
  if (this.tensionAgent) {
    const tension = await this.tensionAgent.observe(this.actionLogs, this.state);
    this.state.variables.global_tension_level = tension.new_tension_level;
  }
  if (this.infoDisruptor && this.state.turn_number % 3 === 0) {
    const report = await this.infoDisruptor.observe(this.actionLogs, this.state);
    this.actionLogs.push({ turn: this.state.turn_number, speakerId: "disruptor_info", ...report });
  }

  this.state.turn_number++;
}
```

### `EnvironmentManager.runEpisode()`

Loops `step()` until a terminal condition is met.

```typescript
async runEpisode(agents: Record<string, ActorAgent>): Promise<[GenericStateObject, object[]]> {
  this.state.is_terminal = false;
  this.state.turn_number = 0;
  this.actionLogs = [];
  this.terminationReason = "timeout";
  this.penaltyCount = {};
  this.lastProposalWasFinal = false;
  this.emit("episode:start", { state: structuredClone(this.state) });

  let tokenUsage = 0;

  while (!this.state.is_terminal && this.state.turn_number < this.config.max_turns_per_episode) {
    // Cost circuit breaker
    if (tokenUsage > this.config.max_episode_tokens) {
      this.state.is_terminal = true;
      this.terminationReason = "token_limit";
      break;
    }

    try {
      await this.step(agents);
    } catch (err) {
      if (err instanceof EpisodeCorruptedError) {
        this.terminationReason = "corrupted";
        break;
      }
      throw err;
    }

    // Accumulate token usage from the last LLM call
    tokenUsage += agents[this.state.current_speaker_id]?.lastTokenUsage ?? 0;
  }

  const finalState = structuredClone(this.state);
  this.emit("episode:complete", { finalState, reason: this.terminationReason });
  return [finalState, this.actionLogs];
}
```

### `EnvironmentManager.mountAgent()`

Validates and injects a Provisioner-designed agent into the live turn order.

```typescript
mountAgent(spec: NewAgentProvisioning): ActorAgent {
  // 1. Schema validation
  const validated = NewAgentProvisioning.parse(spec);

  // 2. Enforce hard spawn cap
  const activeCreated = this.turnOrder.filter(id => this.createdAgentIds.has(id));
  if (activeCreated.length >= this.config.max_active_created_agents) {
    throw new MaxAgentsExceededError(this.config.max_active_created_agents);
  }

  // 3. Instantiate the new ActorAgent
  const newAgent = new ActorAgent({
    archetypeId: validated.agent_id,
    immutableCore: validated.system_prompt,
    mutableStrategy: "", // Created agents start with no mutable layer
  });

  // 4. Register permissions (enforced in step())
  this.agentPermissions[validated.agent_id] = validated.permissions;
  this.createdAgentIds.add(validated.agent_id);

  // 5. Extend turn order based on turn_injection_logic
  //    e.g., "speak_every_3_turns" → insert after every 3rd existing slot
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
```

### `ActorAgent.proposeAction()`

Calls the LLM provider and returns a structured `ActionProposal`.

```typescript
async proposeAction(currentState: GenericStateObject): Promise<ActionProposal> {
  // Build the 3-layer prompt (see core_system_prompts.md §1)
  const messages = [
    { role: "system", content: this.systemPrompt },     // Layer 1 + Layer 2
    { role: "user", content: JSON.stringify(currentState) }, // Layer 3
  ];

  // Append retry context if this is a re-prompt after ZodError
  if (this.retryContext) {
    messages.push({ role: "user", content: `[VALIDATION ERROR] ${this.retryContext}. Correct and try again.` });
    this.retryContext = null;
  }

  const response = await this.llmClient.chat.completions.create({
    model: this.model,
    messages,
    temperature: this.hyperparameters.temperature ?? 0.7,
    frequency_penalty: this.hyperparameters.frequency_penalty ?? 0.0,
    response_format: { type: "json_object" },
  });

  this.lastTokenUsage = response.usage?.total_tokens ?? 0;
  return JSON.parse(response.choices[0].message.content!);
}
```

### `Mutator.evolve()`

The 3-phase mutation pipeline: Generate → Shadow Trial → Commit or Archive.

```typescript
async evolve(
  agent: ActorAgent,
  epochResults: Array<[GenericStateObject, number, number]>,
  config: FrameworkConfig
): Promise<ActorAgent | null> {
  // --- Phase A: Generation ---
  // Identify worst 20% of episodes
  const sorted = [...epochResults].sort((a, b) => a[1] - b[1]); // sort by agent score
  const failingSlice = sorted.slice(0, Math.ceil(sorted.length * 0.2));

  // Query semantic memory for recurring failure patterns
  const failureSummary = this.summarizeFailures(failingSlice);
  const pastFailures = await this.vectorDb.query({
    queryEmbeddings: [await this.embed(failureSummary)],
    where: { judge_score: { $lt: 0 } },
    nResults: 5,
  });

  // Generate 3 mutation variants via the Mutator LLM
  const variants: ActorAgent[] = await this.generateVariants(
    agent, failingSlice, pastFailures, config.mutation_variants
  );

  // --- Phase B: Shadow Trials (The Arena) ---
  let bestVariant: ActorAgent | null = null;
  let bestScore = -Infinity;
  const baselineScore = this.calculateMean(epochResults.map(r => r[1]));

  for (const variant of variants) {
    const shadowScores: number[] = [];
    for (let trial = 0; trial < config.shadow_trial_count; trial++) {
      const env = new EnvironmentManager(structuredClone(this.baselineState), config);
      const [finalState, transcript] = await env.runEpisode({
        [agent.id]: variant,
        ...this.frozenOpponents,
      });
      const [score] = await this.judge.evaluate(this.baselineState, finalState, transcript);
      shadowScores.push(score);
    }
    const variantMean = this.calculateMean(shadowScores);
    if (variantMean > bestScore) {
      bestScore = variantMean;
      bestVariant = variant;
    }
  }

  // --- Phase C: Commitment or Archival ---
  const delta = config.improvement_margin; // default = 0.5
  if (bestVariant && bestScore > baselineScore + delta) {
    // Acceptance: statistically significant improvement
    this.plateauCounter = 0;
    await this.sqlDb.insert("AgentProfiles", {
      system_prompt: bestVariant.systemPrompt,
      created_by: "mutator",
      expected_performance_baseline: bestScore,
    });
    return bestVariant;
  }

  // Rejection: archive to "Failed Tactics" in vector memory
  this.plateauCounter++;
  for (const variant of variants) {
    await this.vectorDb.add({
      documents: [variant.systemPrompt],
      metadatas: [{ tactical_classification: "failed", judge_score: bestScore }],
    });
  }
  return null;
}
```

### `Provisioner.designAgent()`

Analyzes a structural deadlock and outputs a complete agent specification.

```typescript
async designAgent(
  currentState: GenericStateObject,
  epochResults: Array<[GenericStateObject, number, number]>,
  semanticMemoryContext?: object[]
): Promise<NewAgentProvisioning> {
  // Phase 1: Architectural Analysis
  const deadlockSummary = this.analyzeDeadlock(currentState, epochResults);
  const memoryContext = semanticMemoryContext ?? [];

  // Phase 2: LLM-driven Agent Design
  const messages = [
    {
      role: "system",
      content: CREATOR_SYSTEM_PROMPT, // See core_system_prompts.md §2
    },
    {
      role: "user",
      content: JSON.stringify({
        deadlock_summary: deadlockSummary,
        current_state: currentState,
        semantic_memory: memoryContext,
        failed_archetypes: await this.getFailedArchetypes(), // Avoid repeats
      }),
    },
  ];

  const response = await this.llmClient.chat.completions.create({
    model: "gpt-4",
    messages,
    temperature: 0.9, // Higher creativity for novel agent design
    response_format: { type: "json_object" },
  });

  // Phase 3: Strict Zod validation of the design output
  const raw = JSON.parse(response.choices[0].message.content!);
  const spec = NewAgentProvisioning.parse(raw);

  // Phase 4: Safety guardrails — reject game-breaking capabilities
  if (spec.permissions.can_abort_episode || spec.permissions.can_propose_resolution) {
    throw new UnsafeAgentDesignError("Created agents cannot trigger abort_episode or final_offer");
  }
  if (spec.permissions.max_state_mutations_per_turn > 3) {
    throw new UnsafeAgentDesignError("Created agents limited to 3 mutations/turn max");
  }

  return spec;
}
```
