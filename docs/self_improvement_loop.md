# The Self-Improvement Loop

The core innovation of this generalized framework lies in its ability to autonomously evolve strategies over time, without human intervention. This is achieved through an Automated Prompt Optimization (Actor-Critic) pipeline. This logic ensures a monotonically non decreasing performance baseline.

## 1. Multi-Tiered Memory System

To construct self-improving LLM configurations, the framework employs isolated memory systems:

### A. Episodic Memory (Short Term)

* **Purpose**: To retain the precise, chronological state of the current simulation run.
* **Contents**: The unbroken, ordered event list of the active iteration. This includes the public transcript, internal reasoning steps (Chain of Thought), injected environmental factors, and strategic hints from Meta-Agents.

### B. Semantic Memory (Long Term Strategy DB)

* **Purpose**: The central nervous system for self-improvement; knowledge that persists across generations of agents.
* **Contents**: A continuous vector database storing historical `Situations` and corresponding `Outcomes`.
* **Example Entry**:
  * *Situation*: Prompt V1 (Hyper-aggressive opening posture regarding Resource X).
  * *Outcome*: Opponent (Agent B) terminates negotiation on Turn 2 in 84% of trials.
  * *Score*: -5 (Complete Failure)

## 2. The Evaluation Phase (The Judge)

Before an agent can improve, its performance must be objectively graded. Evaluating abstract goals (like resolving a conflict) is notoriously difficult. The framework uses a "Judge" (a high-capability model acting as a Critic).

### The Evaluation Criteria

The Judge evaluates the final condition of the `proposed_state_object` and the `public_transcript` when an episode concludes (either via agreement, walk-away, or timeout).

**Generic Scoring Rubric (-5 to +5):**

* **+5**: Primary objectives exceeded. Opponent made maximal concessions; Agent retained dominant leverage.
* **0**: Status quo maintained (no resolution reached, but communication channels did not collapse entirely).
* **-5**: Primary objectives failed completely. Opponent extracted maximal concessions; Agent abandoned leverage or caused systemic collapse.

**The Judge Prompt**:
The Judge is provided with the generic scoring rubric and the *secret* initial goals of all Primary Actors. It outputs a structured JSON evaluation:

* `agent_a_score`: (integer)
* `agent_b_score`: (integer)
* `agent_a_rationale`: (string justifying Agent A's score based on the final state object)
* `agent_b_rationale`: (string justifying Agent B's score based on the final state object)

## 3. The Mutation Loop (Automated Strategy Generation)

This algorithm operates in three distinct phases to explore new strategies and prevent regression via rigorous A/B testing logic.

### Phase A: Generation (The "Mutator")

1. **Trigger**: This phase initiates periodically (e.g., after an epoch of 10-50 full simulations).
2. **Analysis**: The Meta-Agent (Mutator) reviews the lowest 20% tier of performing episodes in that epoch.
3. **Semantic Retrieval**: It queries Semantic Memory to identify which strategic vectors explicitly failed.
4. **Mutation Output**: It generates **three distinct new strategy permutations**. This output is not merely system prompt text; it incorporates hyperparameter tuning (e.g., modifying `Temperature`, adjusting `frequency_penalty` to prevent cyclic arguments) for creative strategy exploration.
   * *Variant 1*: Assertive/Aggressive opening posture
   * *Variant 2*: Conciliatory/Collaborative framing
   * *Variant 3*: Deceptive/Leverage-based strategy

### Phase B: Shadow Trials (The Arena)

The framework does *not* deploy these unproven mutations directly against production models.

1. **Isolation**: It spins up silent background routines—the "Shadow Simulations."
2. **Execution**: The three mutated Agent A strategies are matched against a static, controlled baseline version of Agent B. Each variant runs a statistically significant number of iterations (e.g., 5-10 trials each) against the baseline. See `evaluation_and_math.md` for the precise acceptance criteria and statistical significance thresholds.

### Phase C: Evaluation & Commitment (The Checkpoint)

The final stage prevents strategic regression.

1. **Evaluation**: The Judge strictly grades the outcomes of the three variant batches in the Arena against the success average of the current production strategy.
2. **Commitment Logic**:
   * **Success**: If a mutated variant yields a statistically significant increase in the final average evaluation score over the active baseline, it is committed to production as the new default `Strategy Prompt` and hyperparameter configuration for that Agent profile.
   * **Failure**: If none of the variants surpass the active baseline, they are permanently archived into a "Failed Tactics" branch of Semantic Memory. The Mutator uses this context on its next generation cycle to avoid exploring identified dead evolutionary branches.

## 4. Addressing Common "Autonomy" Risks

A common critique of self-improving agents is that autonomy inevitably leads to drift and degradation. This framework is architected specifically to defend against the known failure modes of LLM self-correction:

* **The "Feedback Loops Aren't Magical" Problem:** We do not rely on an agent to magically realize it did poorly. The Actor executes. A completely isolated, mathematically constrained `Judge` grades the objective state of the final contract. The `Mutator` only acts on data proven to be failing by the Judge.
* **The "Reflection Adds Latency" Problem:** Actors *do not* reflect dynamically during a turn (aside from their standard Chain of Thought). Reflection and mutation happen entirely out-of-band, analyzing batches of *completed* episodes. The execution loop remains fast and deterministic.
* **System Drift and Degradation over Time:** This is the purpose of **The Shadow Trials (A/B Arena)**. When the Mutator generates a new strategy, it is *never* pushed directly to production. It must survive *N* Shadow Trials against a frozen baseline. If the new strategy does not yield a statistically higher Judge score, it is discarded. The framework is mathematically designed to be non-decreasing in performance.

## 5. Critical Constraints for Meta-Agents

The Mutator possesses the ability to rewrite any aspect of how an Actor behaves, sets configuration variables, or perceives the situation, *with one strict, highly enforced exception*:

* **Immutable Core Goals**: The initial, defining objectives dictating *why* the agent seeks a specific outcome reside outside the mutable prompt structure. **The Meta-Agent must never adjust these core goals.** It may only fundamentally change the *tactical strategy* utilized to attain them.
