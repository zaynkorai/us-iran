# API and Interfaces (The Developer Contract)

To ensure this framework is simple, and usable for developers beyond the US-Iran Simulation, the core library exposes a clean, Object-Oriented API. This document defines the exact class signatures and error-handling fallbacks natively built into the TypeScript application layer.

## 1. Core Interfaces

Developers interact with the following classes to run the framework. All communication between classes uses strictly-typed Zod schemas for runtime validation with full TypeScript type inference.

### A. The `GenericStateObject` (Zod Schema)
The environment revolves around this shared state. Developers extend this base schema to fit their specific use case.

```typescript
import { z } from "zod";

const ConvergenceHypothesisSummary = z.object({
  title: z.string(),
  feasibility_score: z.number().int().min(1).max(10),
  disruption_target: z.string(),
});

const GenericStateObject = z.object({
  /** The core object that primary actors negotiate over. */
  turn_number: z.number().int().default(0),
  current_speaker_id: z.string(),
  is_terminal: z.boolean().default(false),
  
  /** Hypotheses injected by the Explorer Agent for Primary Actors to debate. */
  scout_hypotheses: z.array(ConvergenceHypothesisSummary).optional(),

  // Developers inject specific variables here
  // e.g., us_iran_parameters: { ... }
  variables: z.record(z.string(), z.any()),
});

type GenericStateObject = z.infer<typeof GenericStateObject>;
```

### B. The `EnvironmentManager`
The orchestrator. It manages state transitions, validates the JSON schemas returned by LLMs, enforces agent permissions, and emits events for logging.

```typescript
import { EventEmitter } from "events";

class EnvironmentManager extends EventEmitter {
  state: GenericStateObject;
  config: FrameworkConfig;
  turnOrder: string[] = []; // dynamically extended by Provisioner

  constructor(initialState: GenericStateObject, config: FrameworkConfig) {
    super();
    this.state = initialState;
    this.config = config;
  }

  /** Triggers the next active agent to propose an action. */
  async step(agents: Record<string, ActorAgent>): Promise<void> { ... }

  /** Runs a while loop until state is terminal or max_turns is hit. */
  async runEpisode(agents: Record<string, ActorAgent>): Promise<[GenericStateObject, object[]]> { ... }

  /** Validates and injects a Provisioner-designed agent into the turn order. */
  mountAgent(spec: NewAgentProvisioning): ActorAgent { ... }
}
```

> **Complete method bodies**: The full algorithmic pseudocode for `step()`, `runEpisode()`, `mountAgent()`, `proposeAction()`, `evolve()`, and `designAgent()` is defined in [`engineering_implementation.md` §6](./engineering_implementation.md#6-complete-method-body-pseudocode).

**Supported Events:**
*   `episode:start` — fired when a new episode begins
*   `turn:complete` — fired after each agent's turn, with the `ActionProposal`
*   `episode:complete` — fired when an episode terminates, with the final state
*   `agent:created` — fired when a Provisioner-designed agent is mounted
*   `generation:complete` — fired when all epochs in a generation finish

### C. The `ActorAgent`
The stateless wrapper around the LLM provider API.

```typescript
class ActorAgent {
  id: string;
  systemPrompt: string;

  constructor(opts: { archetypeId: string; immutableCore: string; mutableStrategy: string }) {
    this.id = opts.archetypeId;
    this.systemPrompt = `${opts.immutableCore}\n${opts.mutableStrategy}`;
  }

  /**
   * Submits the agent's turn. Must return a valid ActionProposal
   * (internal monologue + state mutations).
   */
  async proposeAction(currentState: GenericStateObject): Promise<ActionProposal> { ... }
}
```

### D. The `DisruptorAgent`
A specialized agent for Information and Tension disruptors.

```typescript
class DisruptorAgent {
  type: "information" | "tension";

  constructor(disruptorType: "information" | "tension", systemPrompt: string) {
    this.type = disruptorType;
  }

  /**
   * Returns either a DisruptorReport (headline + severity)
   * or a TensionUpdate (new_tension_level + rationale).
   */
  async observe(transcript: object[], state: GenericStateObject): Promise<object> { ... }
}
```

### E. The `Critic` (Judge)
The isolated evaluator. It has no memory across episodes.

```typescript
class Critic {
  rubric: object;

  constructor(rubric: object) {
    this.rubric = rubric;
  }

  /**
   * Returns a map of agent scores and rationales.
   * Scores are integers from -5 to +5.
   */
  async evaluate(
    initialState: GenericStateObject,
    finalState: GenericStateObject,
    transcript: object[]
  ): Promise<{ scores: Record<string, number>, rationales: Record<string, string> }> { ... }
}
```

### F. The `Capitalizer` (Interjector)
The strategic observer that finds hidden overlap.

```typescript
const CapitalizerHint = z.object({
  overlap_detected: z.boolean(),
  confidence_score: z.number().int().min(1).max(10),
  strategic_hint: z.string(),
  rationale: z.string(),
});
type CapitalizerHint = z.infer<typeof CapitalizerHint>;

class Capitalizer {
  constructor() {}

  /**
   * Analyzes the current state and recent internal monologues to calculate 
   * strategic overlap and generate a hint for the next speaker.
   */
  async analyzeOverlap(
    currentState: GenericStateObject,
    recentLogBook: ActionLogs[]
  ): Promise<CapitalizerHint> { ... }
}
```

### G. The `Mutator`
The self-improvement engine. Operates in batch mode across completed epochs.

```typescript
class Mutator {
  private vectorDb: VectorStore;
  private sqlDb: Database;
  private plateauCounter: number = 0;

  constructor(vectorDb: VectorStore, sqlDb: Database) {
    this.vectorDb = vectorDb;
    this.sqlDb = sqlDb;
  }

  /**
   * Generates mutation variants, runs shadow trials, and returns
   * the winning agent if it passes the acceptance criteria.
   * Returns null if no variant beats the baseline.
   */
  async evolve(
    agent: ActorAgent,
    epochResults: Array<[GenericStateObject, Record<string, number>]>,
    config: FrameworkConfig
  ): Promise<ActorAgent | null> { ... }

  /** Returns true if no improvement for `patience` consecutive generations. */
  isPlateaued(patience: number): boolean {
    return this.plateauCounter >= patience;
  }
}
```

### G. The `Provisioner`
The self-creation engine. Designs entirely new agents.

```typescript
class Provisioner {
  /**
   * Analyzes the deadlock and outputs a complete NewAgentProvisioning
   * specification for a new agent to break it.
   */
  async designAgent(
    currentState: GenericStateObject,
    epochResults: Array<[GenericStateObject, Record<string, number>]>,
    semanticMemoryContext?: object[]
  ): Promise<NewAgentProvisioning> { ... }
}
```

### H. The `Explorer` (Possibility Researcher)
The external-facing research engine. Scans available ingredients and synthesizes convergence hypotheses.

```typescript
const Ingredient = z.object({
  ingredient_id: z.string(),
  category: z.enum(["model", "infrastructure", "tooling", "data_source", "framework"]),
  name: z.string(),
  maturity: z.enum(["research", "emerging", "production"]),
  accessibility: z.enum(["public_api", "open_source", "proprietary"]),
  tags: z.array(z.string()),
});
type Ingredient = z.infer<typeof Ingredient>;

const ConvergenceHypothesis = z.object({
  hypothesis_id: z.string(),
  title: z.string(),
  ingredients_combined: z.array(z.string()),
  synthesis: z.string(),
  disruption_target: z.string(),
  feasibility_score: z.number().int().min(1).max(10),
  novelty_score: z.number().int().min(1).max(10),
  why_incumbents_missed_it: z.string(),
});
type ConvergenceHypothesis = z.infer<typeof ConvergenceHypothesis>;

class Explorer {
  ingredients: Ingredient[];

  constructor(ingredientGraph: Ingredient[]) {
    this.ingredients = ingredientGraph;
  }

  /** Runs convergence detection across the ingredient graph. */
  async scan(): Promise<ConvergenceHypothesis[]> { ... }

  /** Adds a new ingredient to the graph (e.g., from a new API release). */
  ingestIngredient(ingredient: Ingredient): void { ... }
}
```

## 2.  Error Handling & Fallbacks

What happens when an LLM fundamentally breaks the rules? The framework uses strict application-layer circuit breakers (as defined in `safety_and_sandboxing.md`).

When `agentA.proposeAction()` returns an invalid output (e.g., hallucinates a JSON key, forgets a comma, or proposes a state transition violating environmental rules), the `EnvironmentManager` executes the following fallback logic:

1.  **Level 1: The Validation Retry Loop**
    *   The `EnvironmentManager` immediately catches the Zod `ZodError`.
    *   It re-prompts the LLM with the exact error message: `"Your output failed schema validation: Missing required field 'internal_monologue'. Please correct and try again."`
    *   This loop repeats for a maximum of $K$ retries (default = 3, configurable via `FrameworkConfig.max_validation_retries`).
2.  **Level 2: The Forced Concession Penalty**
    *   If the LLM fails to generate valid syntax after $K$ retries, the system considers the agent mathematically "stunned."
    *   The `EnvironmentManager` assumes control of that agent's turn. It forces the agent to skip its turn and automatically awards a minor structural concession to the opposing agent.
3.  **Level 3: Ultimate Episode Termination**
    *   If the agent is fundamentally broken (e.g., the API provider is down, or the `Mutator` wrote an illegible strategy prompt), and forced penalties accumulate beyond a threshold (`FrameworkConfig.forced_concession_threshold`), the episode explicitly throws an `EpisodeCorruptedError`.
    *   The `Judge` is bypassed entirely, and both the corrupted Agent and the Mutator are awarded a score of `-5` (Catastrophic System Failure), the lowest possible score on the rubric.
    *   This mathematically ensures the `Mutator` never again explores the specific hyper-parameter set that caused the LLM to hallucinate irreparably.
