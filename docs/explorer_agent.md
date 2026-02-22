# The Explorer Agent (Possibility Researcher)

## 1. The Problem: Invisible Convergence

The most disruptive innovations in AI are not born from breakthroughs — they are born from **convergence**. The individual ingredients already exist publicly, but no one has combined them yet.

**Real-world examples:**
*   **OpenClaw (SaaS Disruption)**: Open-source LLM models existed. Serverless compute existed. API gateway tooling existed. A single developer combined these ingredients into a product that disrupted millions in SaaS revenue overnight. The big companies had access to every single ingredient — they simply didn't see the recipe.
*   **Claude Code Security Blog (Security Market Disruption)**: LLMs existed. Static analysis tooling existed. Vulnerability databases existed. But it was a non-traditional security company (Anthropic) that combined these into a security proof-of-concept, blindsiding the established security industry.

In both cases, the "ingredients" were publicly visible. What was missing was an agent whose *sole purpose* is to scan the landscape, identify convergence points, and synthesize them into actionable disruption hypotheses.

## 2. The Explorer: A New Meta-Agent Archetype

The **Explorer** is a dedicated research and synthesis agent that operates outside the main negotiation loop. Unlike the Mutator (which optimizes strategies) or the Provisioner (which designs new agents), the Explorer's job is to **discover possibilities** that no one is currently pursuing.

### How it fits in the Agent Taxonomy

```
Meta-Agents (The Evolution Engine)
├── The Judge (Critic)       → Evaluates outcomes
├── The Capitalizer          → Whispers strategic hints
├── The Mutator (Generator)  → Optimizes existing strategies
├── The Provisioner              → Designs new agents
└── The Explorer (Researcher)   → Discovers unexplored possibilities
```

The Explorer is the framework's **eyes on the outside world**. While all other agents look inward (at the simulation state, the transcript, the scores), the Explorer looks outward — at the landscape of available ingredients.

## 3. The Ingredient Graph

The Explorer's core data structure is the **Ingredient Graph** — a continuously updated map of available technologies, capabilities, APIs, models, and research papers.

### Schema

```json
{
  "ingredient_id": "ing_042",
  "category": "model_capability",
  "name": "Structured JSON Output (OpenAI, Anthropic, Google)",
  "maturity": "production",
  "accessibility": "public_api",
  "cost_tier": "low",
  "first_observed": "2024-03-15",
  "related_ingredients": ["ing_018", "ing_023"],
  "tags": ["llm", "structured_output", "automation"]
}
```

### Example Ingredients
| ID | Ingredient | Category | Maturity |
|----|-----------|----------|----------|
| ing_001 | Open-source LLMs (Llama, Mistral) | model | production |
| ing_002 | Serverless GPU (Modal, Replicate) | infrastructure | production |
| ing_003 | Browser automation (Playwright) | tooling | production |
| ing_004 | Vulnerability databases (CVE, NVD) | data_source | production |
| ing_005 | Code generation models | model_capability | production |
| ing_006 | Agentic tool-use frameworks (LangChain) | framework | production |
| ing_007 | Real-time speech-to-text | model_capability | production |
| ing_008 | Multimodal vision models | model_capability | emerging |

## 4. The Convergence Detection Algorithm

The Explorer's core logic is a **pairwise and n-wise combination analysis** of ingredients. For every subset of ingredients, it asks the LLM:

> *"Given these N ingredients that are currently publicly available, what novel product, tool, or capability could be built by combining them — that does NOT currently exist on the market?"*

### The Explorer's Structured Output

```json
{
  "hypothesis_id": "hyp_117",
  "title": "Autonomous Security Auditor",
  "ingredients_combined": ["ing_005", "ing_004", "ing_003"],
  "ingredient_names": ["Code generation models", "Vulnerability databases", "Browser automation"],
  "synthesis": "Combine a code-generation model with CVE/NVD vulnerability data to create an agent that autonomously tests web applications for known vulnerability patterns using Playwright for browser automation.",
  "disruption_target": "Security consulting firms, manual penetration testing",
  "feasibility_score": 8,
  "novelty_score": 7,
  "estimated_time_to_market": "2-4 weeks by a solo developer",
  "why_incumbents_missed_it": "Traditional security firms think in terms of signature-based scanning. They have not connected LLM code understanding to live browser testing."
}
```

### The Critical Field: `why_incumbents_missed_it`

This is the Explorer's most valuable output. It forces the LLM to reason about the **blind spots** of existing market players. The OpenClaw disruption happened because incumbents had all the ingredients but were thinking in legacy product paradigms. The Explorer is explicitly prompted to identify these cognitive blind spots.

## 5. How the Existing Framework Challenges the Explorer

A dedicated "Skeptic" agent is **not needed**. The Explorer's hypotheses are naturally stress-tested by the framework's existing adversarial pipeline — the same pipeline that already challenges every other agent:

| Challenge Mechanism | How It Challenges the Explorer |
|--------------------|-----------------------------|
| **The Primary Actors** | When Explorer hypotheses are injected into the `EnvironmentState`, the debating agents (e.g., "Enterprise Buyer" vs. "Lab Strategist") naturally argue for and against them. An agent biased toward market adoption will tear apart technically infeasible hypotheses. An agent biased toward innovation will push back on conservative dismissals. |
| **The Judge** | After reality plays out (e.g., 3 weeks later, OpenClaw drops), the Judge retrospectively scores whether the Explorer's hypotheses materialized. This is the ground-truth signal. |
| **The Mutator** | Based on the Judge's retrospective scores, the Mutator evolves the Explorer's prompt — making it better at identifying real convergences and worse at generating noise. |
| **The Shadow Trials** | New Explorer prompt versions are A/B tested against historical data before being committed to production. |

This is the same principle that governs every other agent in the system: **the framework itself is the adversary**. No special-purpose challenger is needed.

## 6. Integration with the Framework

### Scheduling Triggers

The Explorer operates outside the main execution loop. Its scans are triggered by one of three mechanisms:

| Trigger | Condition | Rationale |
|---------|-----------|-----------|
| **Cron-based** | Every $S$ generations (default $S = 5$) | Ensures periodic sweeps regardless of system activity |
| **Event-driven** | When `ingestIngredient()` is called (new ingredient arrives) | A new ingredient may unlock previously infeasible combinations |
| **Manual** | User calls `scout.scan()` explicitly | For ad-hoc research when a market event occurs |

The scheduling is configured in `FrameworkConfig`:

```typescript
// Explorer Settings (add to FrameworkConfig)
scout_sweep_interval_generations: z.number().int().default(5),
scout_on_new_ingredient: z.boolean().default(true),
```

### Phase 1: Ingredient Collection
The Explorer periodically ingests new ingredients from:
*   Public AI model release announcements
*   GitHub trending repositories
*   arXiv paper abstracts (via API)
*   API changelog feeds (OpenAI, Anthropic, Google, etc.)
*   User-provided manual entries

### Phase 2: Convergence Sweep
The Explorer runs its combination analysis across the ingredient graph. It generates a ranked list of **Convergence Hypotheses** — products or capabilities that *could* be built today from existing ingredients.

### Phase 3: Injection into the Debate
The Explorer's hypotheses are injected into the `EnvironmentState` as a new field:

```json
{
  "scout_hypotheses": [
    {
      "title": "Autonomous Security Auditor",
      "feasibility_score": 8,
      "disruption_target": "Security consulting"
    },
    {
      "title": "Zero-Config SaaS Builder",
      "feasibility_score": 9,
      "disruption_target": "No-code platforms"
    }
  ]
}
```

The Primary Actor agents (e.g., The Lab Strategist, The Enterprise Buyer, The Developer Community) then debate which of the Explorer's hypotheses is most likely to materialize — and who will build it first.

### Phase 4: Retrospective Scoring
When a real-world disruption event occurs (e.g., OpenClaw drops), the Judge scores the Explorer:
*   **Did the Explorer identify this convergence before it happened?** → +5
*   **Did the Explorer identify the ingredients but miss the combination?** → +1
*   **Did the Explorer completely miss it?** → -5

Over time, the **Mutator evolves the Explorer's prompt** to better detect convergence patterns that lead to actual disruptions.

## 7. The Explorer's Prompt Blueprint

> **Reference**: The complete system prompt for the Explorer Agent, including its few-shot examples and structure, is maintained centrally in [`core_system_prompts.md`](./core_system_prompts.md).

## 8. Why This Agent is Unique

| Property | Mutator | Provisioner | Explorer |
|----------|---------|---------|-------|
| **Looks at** | Internal logs (past failures) | Internal state (deadlock patterns) | External world (available ingredients) |
| **Produces** | Better strategies for existing agents | Entirely new agents | Possibility hypotheses |
| **Triggered by** | End of an epoch | Prolonged deadlock | Periodic schedule or new ingredient arrival |
| **Challenged by** | Shadow Trials | Natural Selection | The existing debate pipeline |
| **Optimized by** | Judge scores → Mutator | Judge scores → Mutator | Judge scores → Mutator |

The Explorer is the only agent in the framework that looks **outward**. Every other Meta-Agent is introspective — analyzing internal logs, internal state, internal scores. The Explorer brings external knowledge into the system, and the existing adversarial framework naturally stress-tests its output — no dedicated Skeptic required.
