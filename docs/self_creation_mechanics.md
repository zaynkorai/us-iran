# Self-Creation Mechanics

While the *Self-Improvement Loop* mutates existing parameters (Strategy Prompts, Hyperparameters) for existing agents, the **Self-Creation Mechanics** allow the general framework to dynamically architect, provision, and deploy entirely new conceptual entities into the simulation.

This represents the transition from a learning agent framework to a truly self-creating ecosystem.

## 1. The Core Problem: Systemic Deadlocks

In highly polarized simulations with diametrically opposed Actor goals, the Self-Improvement Loop may eventually reach a Nash Equilibrium where neither agent can improve their score without violating their immutable core objectives.

* **The Symptom**: Thousands of iterations resulting in immediate `abort_episode` actions from Primary Actors, or endlessly cycling through dialogue turns with a `State Object` that remains entirely unchanged.
* **The Diagnosis**: The `Mutator` Meta-Agent recognizes that evolving the *tactics* of Agent A or Agent B is insufficient; the *structure* of the specific environment itself lacks the necessary pathways for resolution.

### The Mathematical Trigger Condition

The Provisioner is activated when the **best-performing mutation** fails to improve the baseline score for $K$ consecutive generations:

$$
\forall g \in [t-K, t]: \quad \max(\mu_{mutated}^{(g)}) \leq \mu_{baseline}^{(g)} + \delta
$$

Where $K$ is a configurable "patience" parameter (default = 5 generations) and $\delta$ is the improvement margin (default = 0.5). This means: if the Mutator has tried and failed to beat the baseline for 5 straight generations, the system has reached a structural deadlock that requires architectural intervention, not tactical mutation.

## 2. Mechanism of Action: The Provisioner Agent

When a fundamental, systemic deadlock is detected (after $K$ consecutive failed generations, see the trigger formula above), the framework activates a specialized Meta-Agent known as **The Provisioner**.

The Provisioner is an LLM agent instructed to analyze the semantic history of the deadlock and design a new participant to alter the negotiation dynamics.

### Phase 1: Architectural Analysis

The Provisioner reviews Semantic Memory, focusing specifically on:

1. The immutable goals causing the friction.
2. The gaps or inflexible parameters in the current `State Object`.
3. The specific pressure points or constraints that trigger `abort_episode` events.

### Phase 2: Agent Design Output

The Provisioner outputs a complete specification for a new `LLMAgent` class instance. This JSON structure defines the new agent's purpose, capabilities, and system prompt.

```json
{
  "agent_id": "intermediary_broker_01",
  "archetype": "broker",
  "turn_injection_logic": "speak_every_3_turns",
  "system_prompt": "You are a neutral Broker agent. You cannot dictate terms, but you can offer external data validation or conditional incentives to either primary party if they agree to structural concessions. Your goal is to maximize the likelihood of a resolution, regardless of the specific baseline terms.",
  "core_goals": [
      "Facilitate an agreement that bridges the primary divide",
      "Offer external subsidies (up to 500 units) to offset perceived losses by either primary party"
  ],
  "permissions": {
      "can_modify_fields": ["proposed_state_object.external_subsidies"],
      "cannot_modify_fields": ["agent_a_concessions", "agent_b_concessions"],
      "can_abort_episode": false,
      "can_propose_resolution": false,
      "max_state_mutations_per_turn": 1
  },
  "design_rationale": "Primary actors distrust each other's self-reported data. An independent broker can offer external validation and conditional incentives to break the trust deadlock."
}
```

### Phase 3: The Instantiation 

1. **Validation**: The Environment parses the Provisioner's output. It validates the schema and ensures the newly proposed agent does not possess game breaking capabilities (e.g., it cannot override the final "abort_episode" decisions of the primary actors).
2. **Mounting**: The new agent (`intermediary_broker_01`) is instantiated as an active `LLMAgent` object in the system.
3. **Injection**: The Environment modifies its own Execution Loop logic based on the `turn_injection_logic`. (e.g., changing the turn sequence from `Agent A -> Agent B -> Agent A` to `Agent A -> Agent B -> Intermediary Broker -> Agent A`).

### Phase 4: Permissions Binding

Every created agent receives a strict **permissions scope** that limits what it can do in the environment:

```json
{
  "permissions": {
    "can_modify_fields": ["proposed_state_object.external_subsidies"],
    "cannot_modify_fields": ["agent_a_concessions", "agent_b_concessions"],
    "can_abort_episode": false,
    "can_propose_resolution": false,
    "max_state_mutations_per_turn": 1
  }
}
```

The `EnvironmentManager` enforces these permissions on every turn. A created agent that attempts to exceed its scope is penalized identically to a Primary Actor that hallucinates invalid JSON (see `api_and_interfaces.md`).

### Hard Limits on Agent Spawning

To prevent the Provisioner from flooding the environment with noise:

* **Maximum Active Created Agents**: The framework enforces a hard cap of $M$ simultaneously active created agents (default $M = 3$). If the Provisioner wants to spawn a 4th agent, it must first designate an existing created agent for termination.
* **Cooldown Period**: After a creation attempt (successful or failed), the Provisioner cannot trigger again for at least $C$ generations (default $C = 3$), giving the system time to evaluate the impact of the new agent.

## 3. Dynamic Types of Created Agents

The Provisioner is not limited to diplomatic brokers. Depending on the deadlock, it might organically spawn:

* **A Technical Arbiter**: (e.g., a "Validator Agent") injected specifically to provide objective measurements or verification steps that the primary actors refuse to trust from one another.
* **A Proxy Actor**: (e.g., an "Ally Agent") designed to apply localized pressure or offer separate, peripheral concessions to one of the main actors to break a logjam on a core issue.
* **A New Disruptor**: (e.g., an "External Threat Agent") designed to artificially spike the `global_tension_level` to force urgency on actors who are comfortably stalling.

## 4. Evaluation and Pruning

Self-creation is risky; newly spawned agents might introduce noise rather than value. Therefore, they are subject to "Natural Selection."

1. **The Shadow Test**: Similar to the prompt mutation process, the newly created agent is first tested in the Arena (Shadow Simulations) against frozen baselines.
2. **The Judge's Verdict**: The Judge evaluates the new episodes. Did the introduction of the `intermediary_broker_01` increase the average combined resolution score of the primary actors compared to the deadlocked baseline?
3. **Survival or Termination**:
   * If yes, the agent is committed to the main `ExecutionEnvironment` and becomes a permanent fixture of future simulations for that specific scenario.
   * If no (it failed to break the deadlock or made it worse), it is terminated, and the failure is logged to Semantic Memory to prevent the Provisioner from trying that specific archetype again.
