# Evaluation and Mathematics (The Rigor of Self-Improvement)

The term "Self-Improving AI" is often used loosely to describe models that merely reflect on their own text. In this framework, "Self-Improvement" is a strictly mathematical process. 

Unless a new strategy mathematically yields a higher score against a statistical baseline, it is discarded. This document outlines the quantitative evaluation formulas used by the `Judge` and the `Arena`.

## 1. The Judge's Scoring Formula

The `Judge` Meta-Agent evaluates every completed episode in isolation. It does not know the history of the actors. It only sees the definitive start state, the final end state, and the transcript.

### The Objective Function (Maximize Concessions, Minimize Losses)
For any Agent $i$ (e.g., Agent A), the Judge calculates a continuous or discrete score $S_i$ based on the final configuration of the `GenericStateObject` ($State_{final}$).

The fundamental scoring logic follows a simplistic reward function:
$$ S_i = w_{primary} \cdot f(Target_i) - w_{penalty} \cdot g(Concession_i) $$

Where:
*   $f(Target_i)$: The degree to which Agent $i$ achieved its primary required parameters.
*   $g(Concession_i)$: The degree to which Agent $i$ was forced to yield its own critical resources.
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

### The Acceptance Criteria (P-Value & Thresholds)
The Mutator will **only** commit Strategy V2 to production if two conditions are met:

1.  **Absolute Improvement**: The new average score must be higher than the old average score.
    $$ \mu_{mutated} > \mu_{baseline} + \delta $$
    (Where $\delta$ is a configurable margin of error, default = 0.5 points).

2.  **Statistical Significance (Optional/Advanced)**: For enterprise deployments, the framework supports calculating a standard independent two-sample T-test. Strategy V2 is only accepted if the calculated $p$-value is less than $0.05$ (meaning there is a 95% probability the improvement is due to the strategy mutation, not just standard deviation in LLM generation). **Note:** For small sample sizes ($N < 30$), the Mann-Whitney U test (a non-parametric alternative) is recommended, as it does not assume a normal distribution of scores.

## 3. The Mathematics of Evolution

Because of this strict Arena logic, the performance of any Agent in the framework over Time ($t$) is structurally guaranteed to be **Monotonically Non-Decreasing**.

$$ \mu(t+1) \geq \mu(t) $$

If the Mutator generates 100 terrible, hallucinated, or flawed strategies in a row, the `Arena` will reject all 100 of them because $\mu_{mutated} < \mu_{baseline}$. The Agent will simply continue using the baseline strategy until the Mutator randomly discovers a prompt modification that mathematically beats the benchmark. 

This strict mathematical gating is the framework's absolute defense against "Autonomy Drift."

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
