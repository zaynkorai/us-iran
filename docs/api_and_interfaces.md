# API and Interfaces (The Developer Contract)

To ensure this framework is portable and conceptually clean, the core library exposes a language agnostic API. This document defines the exact boundaries, contracts, and error handling fallbacks using abstract Interface Definition Language (IDL) and data schemas.

While the reference implementation is a Native TypeScript Library, the architectural contract below is language agnostic.

> **Configuration source of truth**: See [`configuration_reference.md`](./configuration_reference.md) for the complete `FrameworkConfig` field list and defaults.

## 1. Core Data Schemas

All communication between agents uses strictly validated structured payloads.

### `GenericStateObject`
The environment revolves around this shared state. Developers extend this base schema to fit their specific use case.

| Field | Type | Required | Description |
|---|---|---|---|
| `turn_number` | `Integer` | Yes | The current turn of the execution loop (default: 0). |
| `current_speaker_id` | `String` | Yes | Identifier of the active agent. |
| `is_terminal` | `Boolean` | Yes | Whether the episode has ended (default: false). |
| `scout_hypotheses` | `Array<ConvergenceHypothesisSummary>` | No | Hypotheses injected by the Explorer Agent. |
| `variables` | `Map<String, Any>` | Yes | Developer-injected specific variables (e.g., tension scores). |

## 2. Core Service Interfaces

### `EnvironmentManager`
The central orchestrator. It manages state transitions, validates schemas returned by models, enforces permissions, and emits events.

```idl
interface EnvironmentManager {
  // State
  State state;
  Config config;
  List<String> turnOrder;

  // Methods
  void Step(Map<String, ActorAgent> agents);
  Tuple<State, List<Log>> RunEpisode(Map<String, ActorAgent> agents);
  ActorAgent MountAgent(NewAgentProvisioning spec, LLMClient llmClient);
}
```

> **Complete method bodies**: The full algorithmic pseudocode for `step()`, `runEpisode()`, etc. is defined in [`engineering_implementation.md` §6](./engineering_implementation.md#6-complete-method-body-pseudocode).

**Supported Abstract Events:**
*   `episode:start` — Fired when a new episode begins.
*   `turn:complete` — Fired after each agent's turn.
*   `episode:complete` — Fired when an episode terminates.
*   `agent:created` — Fired when a Provisioner-designed agent is mounted.
*   `generation:complete` — Fired when all epochs in a generation finish.

### `ActorAgent`
The stateless wrapper around the LLM provider API.

```idl
interface ActorAgent {
  String id;
  String systemPrompt;

  // Receives the global state, returns proposed actions
  ActionProposal ProposeAction(State currentState);
}
```

### `DisruptorAgent`
Specialized agents for Information and Tension disruptors.

```idl
interface DisruptorAgent {
  String type; // "information" or "tension"

  // Observes transcript and state, returns generic Object
  Object Observe(List<Log> transcript, State currentState);
}

class InformationDisruptor implements DisruptorAgent { ... }
class TensionDisruptor implements DisruptorAgent { ... }
```

### `Critic` (Judge)
The isolated evaluator. It has no memory across episodes.

```idl
interface Critic {
  // Constructor injects dependencies
  Critic(String rubric, String systemPrompt, LLMClient llmClient);

  // Evaluates end state and returns scores mapped by agent ID
  EvaluationResult Evaluate(State initialState, State finalState, List<Log> transcript);
}

struct EvaluationResult {
  Map<String, Integer> scores;
  Map<String, String> rationales;
}
```

### `Capitalizer` (Interjector)
The strategic observer that calculates hidden overlap.

```idl
interface Capitalizer {
  // Analyzes raw logs and outputs hints for the active speaker
  CapitalizerHint AnalyzeOverlap(State currentState, List<Log> recentLogBook);
}

struct CapitalizerHint {
  Boolean overlap_detected;
  Integer confidence_score; // 1-10
  String strategic_hint;
  String rationale;
}
```

### `Mutator`
The self-improvement engine. Operates in batch mode across completed epochs.

```idl
interface Mutator {
  // Generates variations, runs shadow trials, returns best agent or null
  ActorAgent Evolve(ActorAgent agent, List<EpochResult> epochResults, Config config);

  // Checks if plateau threshold has been reached
  Boolean IsPlateaued(Integer patience);
}
```

### `Provisioner`
The self-creation engine.

```idl
interface Provisioner {
  // Analyzes deadlock and outputs entirely new agent specification
  NewAgentProvisioning DesignAgent(
    State currentState,
    List<EpochResult> epochResults,
    List<String> failedArchetypes,
    List<Object> semanticMemoryContext
  );
}
```

### `Explorer` (Possibility Researcher)
Scans external capabilities and synthesizes convergence points.

```idl
interface Explorer {
  List<Ingredient> ingredients;

  Explorer(List<Ingredient> graph, String systemPrompt, LLMClient client);

  List<ConvergenceHypothesis> Scan();
  void IngestIngredient(Ingredient ingredient);
}
```

## 3. Error Handling & Fallbacks

What happens when an LLM fundamentally breaks the rules? The framework uses strict application-layer circuit breakers (as defined in `safety_and_sandboxing.md`).

When `ActorAgent.ProposeAction()` returns an invalid output, the `EnvironmentManager` executes the following fallback logic:

1.  **Level 1: The Validation Retry Loop**
    *   The `EnvironmentManager` catches the schema validation error.
    *   It re-prompts the LLM with the exact error message: `"Your output failed schema validation: Missing required field... Please correct and try again."`
    *   This loops for a maximum of $K$ retries (configured via `max_validation_retries`).
2.  **Level 2: The Forced Concession Penalty**
    *   If the agent fails to generate valid syntax after $K$ retries, the system considers it mathematically "stunned."
    *   The `EnvironmentManager` forces the agent to skip its turn, awarding a structural concession to the opposing agent.
3.  **Level 3: Ultimate Episode Termination**
    *   If penalties accumulate beyond a threshold (`forced_concession_threshold`), the episode throws a severe internal error.
    *   The `Judge` is bypassed, and the corrupted Agent and Mutator receive the lowest possible score (`-5`), mathematically ensuring the `Mutator` discards the flawed prompt.
