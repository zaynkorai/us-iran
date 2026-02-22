# Agent Design and State Management

To ensure the environment functions deterministically and agents possess consistent context, the generic framework relies on a state management system and strictly enforced structured outputs.

## 1. The `EnvironmentState` Object

The Environment does not act as a simple chat wrapper passing raw string transcripts to the Actor agents. Instead, it constructs and passes a structured JSON object (`EnvironmentState`) each turn. This allows agents to programmatically parse complex data rather than relying entirely on LLM text comprehension.

```json
{
  "turn_number": 4,
  "max_turns": 20,
  "current_speaker_id": "agent_b",
  "public_transcript": [
    {"speaker": "agent_a", "text": "We demand exclusive rights to Resource X."},
    {"speaker": "agent_b", "text": "We will grant limited access if Parameter Y is increased."},
    {"speaker": "disruptor_info", "text": "ALERT: Supply of Resource X dwindling rapidly!"}
  ],
  "proposed_state_object": {
    "agent_a_concessions": {
        "parameter_y_value": 50,
        "resource_z_allocation": 10
    },
    "agent_b_concessions": {
        "resource_x_exclusive_rights": false,
        "compliance_inspections": "daily"
    }
  },
  "environmental_variables": {
    "global_tension_level": 7,
    "information_noise_score": 85
  },
  "injections": {
      "capitalizer_hint": "They are desperate for Resource Z. If you offer this, they might cave on Resource X."
  }
}
```

**Benefits of Structured State:**
*   **Precision:** Agents interact directly with the `proposed_state_object` object, proposing explicit numeric or string modifications rather than vague textual agreements regarding abstract variables.
*   **Context Grounding:** The `environmental_variables` (e.g., `global_tension_level`) are fed directly into the parsing context, allowing the LLM to adjust its reasoning and tone dynamically based on crisis severity.

## 2. Agent Output Schemas

When the Environment prompts an agent to act, the agent **must** return a strictly typed JSON object. This is typically enforced by a framework tool (like Instructor or LangChain Structured Output wrappers).

### A. Primary Actor Output Schema

```json
{
  "internal_monologue": "The opponent is extremely protective of Resource X. If I push harder, they will walk away. I should pivot to offering Resource Z as a sweetener while maintaining my demand on Parameter Y.",
  "public_dialogue": "We agree to increase Parameter Y, but only if you immediately grant exclusive rights to Resource X.",
  "state_mutations": [
      {
          "action": "modify",
          "path": "agent_a_concessions.parameter_y_value",
          "value": 65
      }
  ],
  "propose_resolution": false,
  "abort_episode": false
}
```

### B. Stochastic Shock Output Schema

```json
{
  "headline": "BREAKING: Resource X supply chain collapses amid stalled negotiations!",
  "severity": "high",
  "inject_into_transcript": true
}
```

### C. Disruptor Output Schema

```json
{
  "new_tension_level": 8,
  "rationale": "Agent A escalated demands. Agent B's response was combative. Disruptor injected a supply crisis headline."
}
```

## 3. The Role of the `internal_monologue`

The `internal_monologue` field represents the agent's "Chain of Thought" (CoT). This is arguably the most critical component for effective, long-term simulated negotiations.

1.  **Forced Reasoning:** It forces the LLM to articulate its strategic rationale *before* generating the public `dialogue` or modifying the state. This heavily mitigates hallucination and drastically improves consequence planning.
2.  **Privacy:** The Environment explicitly extracts the `internal_monologue` and logs it to Episodic Memory. It is **never** appended to the `public_transcript` seen by the opposing Actor.
3.  **Vulnerability:** While hidden from the opponent, it is visible to Meta Agents (like the Capitalizer), allowing them to analyze the true, hidden goals and constraints of the negotiating parties and calculate systemic overlap.

## 4. Disconnects and Finalization

The `propose_resolution` and `abort_episode` booleans determine the termination conditions of an episode (a single simulation run).

*   **Walk Away:** If any Actor outputs `"abort_episode": true`, the Environment immediately halts the execution loop and triggers the Evaluation Phase (The Judge). Both primary agents typically receive heavy penalties (e.g., -5) unless their secret instructions specifically incentivized tanking the talks.
*   **Finalizing an Agreement:** An agreement is not considered finalized just because one Actor outputs `"propose_resolution": true`. The generic framework requires *consecutive agreement*. If Agent A outputs `propose_resolution: true`, the simulation continues. Agent B must respond in the immediate next turn with `propose_resolution: true` for the Environment to recognize a successful, binding resolution on the current `State Object`.
