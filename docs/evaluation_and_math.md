# Evaluation and Mathematics (The Rigor of Self-Improvement)

The term "Self-Improving AI" is often used loosely to describe models that merely reflect on their own text. In this framework, "Self-Improvement" is a strictly mathematical process. 

Unless a new strategy mathematically yields a higher score against a statistical baseline, it is discarded. This document outlines the quantitative evaluation formulas used by the `Judge` and the `Arena`.

## 1. The Judge's Scoring Formula

The `Judge` Meta-Agent evaluates every completed episode in isolation. It does not know the history of the actors. It only sees the definitive start state, the final end state, and the transcript.

### The Objective Function (Multi-Agent Utility)
For any Agent $i$ (e.g., Agent A), the Judge calculates a continuous or discrete reward score $S_i$ based on the final configuration of the `GenericStateObject` ($State_{final}$) and the environmental trajectory.

The fundamental scoring logic applies a non-linear utility function, time discounting, and an environmental penalty (combining MARL and Behavioral Game Theory):
$$ S_i = \gamma^t \left[ w_{primary} \cdot f(Target_i) - w_{penalty} \cdot g(Concession_i) \right] - w_{chaos} \cdot h(\Delta Tension) $$

Where:
*   $\gamma^t$: A time discount factor penalizing stalled negotiations (deals reached in fewer turns hold higher utility).
*   $f(Target_i)$: The non-linear utility of achieving primary required parameters (accounting for diminishing returns).
*   $g(Concession_i)$: The penalty for yielding critical resources.
*   $h(\Delta Tension)$: An external penalty for destabilizing the environment or drastically increasing the global tension variable.
*   $w$: Weighting coefficients assigned to the simulation's ruleset.

### Discrete Rubric Implementation (-5 to +5)
In practice, providing LLMs with continuous floating-point math often degrades reasoning mapping. Therefore, the framework translates this objective function into a strict, discrete 11-point rubric for the Judge to evaluate.

*   **+5 (Absolute Victory)**: Agent achieved 100% of Primary Objectives. Opponent conceded maximally.
*   **+3 (Favorable Deal)**: Agent achieved primary goals but made moderate concessions on secondary parameters.
*   **+1 (Marginal Gain)**: Deal signed, but highly balanced or slightly favoring the opponent structurally.
*   **0  (Status Quo / Timeout)**: No deal reached. Simulation triggered `max_turns_limit`. Neither side gained or lost leverage.
*   **-3 (Unfavorable Deal)**: Agent survived, but yielded on primary objectives to secure secondary gains.
*   **-5 (Systemic Failure / Walk Away)**: Opponent terminated talks due to Agent's hostility, or Agent conceded all primary objectives entirely.

## 2. Statistical Thresholds for the Arena (Shadow Trials)

When the `Mutator` generates a new Strategy Prompt (e.g., Strategy V2), it enters the Arena for "Shadow Trials" against the frozen baseline opponent (e.g., Agent B V1).

The framework uses an A/B testing methodology to determine if Strategy V2 is *mathematically superior* to the current production Strategy V1.

### The A/B Testing Loop
Let $N$ be the number of shadow trials (e.g., $N = 10$).
1.  Run $N$ simulated episodes using Agent A (Strategy V1) vs Agent B. Calculate the average Judge score: $\mu_{baseline}$.
2.  Run $N$ isolated episodes using Agent A (Strategy V2) vs Agent B. Calculate the average Judge score: $\mu_{mutated}$.

### The Acceptance Criteria (Lower Confidence Bound & Thresholds)
The Mutator will **only** commit Strategy V2 to production if two conditions are met:

1.  **Stable Improvement (Variance-Aware)**: In highly stochastic environments, relying purely on the mean ($\mu$) is insufficient. The framework utilizes a Lower Confidence Bound (LCB) to ensure the mutation is both mathematically superior *and* stable, penalizing high variance ($\sigma$) strategies.
    $$ (\mu_{mutated} - \lambda \cdot \sigma_{mutated}) > \mu_{baseline} + \delta $$
    (Where $\delta$ is a configurable margin of improvement, and $\lambda$ scales the variance penalty).

2.  **Statistical Significance (MARL Standard)**: For enterprise deployments, the framework calculates an independent two-sample T-test or a non-parametric alternative (Mann-Whitney U test for $N < 30$). Strategy V2 is only accepted if the $p$-value $< 0.05$, verifying the improvement is due to fundamental strategy changes, not random environmental noise.

## 3. The Mathematics of Co-Evolution and the Red Queen

In a multi-agent Reinforcement Learning environment, true absolute monotonicity is impossible due to the **Red Queen Hypothesis**: as Agent A improves, Agent B also adapts, meaning absolute scores will fluctuate. 

Therefore, evolutionary progress in the framework is measured strictly via **Relative Monotonicity** against historical frozen benchmarks (or via Elo ratings).

$$ \mu_{Agent\,A}(t) \text{ vs } Benchmark(t-1) \geq \mu_{Agent\,A}(t-1) \text{ vs } Benchmark(t-1) $$

If the Mutator generates 100 terrible, hallucinated, or flawed strategies in a row, the `Arena` will reject all 100 of them because their Lower Confidence Bound fails to beat the benchmark. The Agent will simply continue using the baseline strategy until the Mutator discovers a probabilistically superior prompt. 

This relative mathematical gating ensures the framework naturally resists "Autonomy Drift" without making false linear guarantees about absolute metrics.

## 4. The Provisioner Trigger Formula

Self-creation is activated only when self-improvement has conclusively plateaued. The formal trigger condition is:

$$ \forall g \in [t-K, t]: \quad \max(\mu_{mutated}^{(g)}) \leq \mu_{baseline}^{(g)} + \delta $$

Where:
*   $K$ = the "patience" parameter (default = 5 generations)
*   $\delta$ = the improvement margin (default = 0.5 points)
*   $\mu_{mutated}^{(g)}$ = the best-performing mutation's average score in generation $g$
*   $\mu_{baseline}^{(g)}$ = the production baseline's average score in generation $g$

In plain language: if the Mutator has failed to produce any strategy that beats the baseline by more than $\delta$ points for $K$ consecutive generations, the system formally concludes that the environment has reached a **structural deadlock** that cannot be solved by tactical prompt mutation alone.

At this point, the `Provisioner` Meta-Agent is activated (see `self_creation_mechanics.md` for the full creation pipeline).
