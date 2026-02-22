# Applicability Matrix

This document defines exactly what this framework is and is not designed for. Understanding the structural prerequisites helps developers determine whether their use case maps cleanly to the Self-Creating Framework or requires a fundamentally different architecture.

## 1. The Three Structural Prerequisites

The framework applies to any domain that satisfies **all three** of the following conditions:

| # | Prerequisite | Description |
|---|-------------|-------------|
| 1 | **Multiple agents with distinct goals** | At least two entities with partially or fully conflicting objectives that must interact to produce an outcome. |
| 2 | **A measurable, structured state** | A JSON-serializable object (the `GenericStateObject`) that changes over time as agents take actions. Progress must be quantifiable, not purely narrative. |
| 3 | **An objective scoring function** | A deterministic or LLM-assisted evaluator (the `Judge`) that can assign a numeric score to the final state. Without this, the Mutator has no signal to optimize against. |

If your use case satisfies all three, the framework's self-improvement loop (Mutator) and self-creation mechanics (Provisioner) will function as designed.

## 2. Perfect Fit ✅

These use cases map directly to the framework's architecture with minimal or no adaptation:

### A. Geopolitical Conflict Simulation
*   **Agents**: Sovereign nations, coalitions, international organizations
*   **State**: Treaty parameters (sanctions, enrichment caps, inspection regimes)
*   **Judge**: Goal achievement against secret diplomatic objectives
*   **Self-Creation**: Mediators, inspectors, ally factions spawn organically
*   *Example*: The US-Iran simulation

### B. Domestic Political Conflict
*   **Agents**: Government faction, opposition party, civil society groups
*   **State**: Policy parameters (budget allocations, regulatory changes, reform timelines)
*   **Judge**: Stability metrics + public approval scores + economic impact
*   **Self-Creation**: Judicial review agents, lobbyist agents, media pressure agents

### C. Labor & Business Negotiations
*   **Agents**: Union representatives, corporate management
*   **State**: Contract terms (wages, benefits, working hours, layoff protections)
*   **Judge**: Fairness index + economic viability + workforce satisfaction
*   **Self-Creation**: Arbitrator agents, industry regulator agents

### D. Multi-Party Resource Allocation
*   **Agents**: Departments, divisions, or stakeholders competing for finite resources
*   **State**: Budget splits, headcount, infrastructure access
*   **Judge**: ROI per allocation unit + organizational KPIs
*   **Self-Creation**: Auditor agents, priority-escalation agents

### E. Climate & Environmental Policy
*   **Agents**: Industrial nations, developing nations, NGOs
*   **State**: Emission caps, carbon credits, funding commitments, compliance timelines
*   **Judge**: Environmental impact score + economic cost distribution
*   **Self-Creation**: Scientific advisory agents, enforcement mechanism agents

### F. Game Theory Research
*   **Agents**: Any number of strategic players
*   **State**: Payoff matrices, resource pools, commitment variables
*   **Judge**: Nash Equilibrium proximity + Pareto efficiency
*   **Self-Creation**: Mechanism design agents that alter the rules of the game itself

### G. Legal Dispute Resolution & Settlement
*   **Agents**: Plaintiff counsel, defendant counsel, (optionally) insurer representatives
*   **State**: Settlement terms (monetary damages, liability admission %, injunctive relief scope, NDA clauses)
*   **Judge**: Case-law alignment score + cost-of-litigation avoidance + precedent risk
*   **Self-Creation**: Mediator agents, expert witness agents that inject domain-specific technical testimony, appellate risk assessor agents

### H. Supply Chain & Trade War Simulation
*   **Agents**: Exporting nation, importing nation, multinational corporation caught in the middle
*   **State**: Tariff rates, quota limits, export licenses, rare-earth mineral allocations, port access
*   **Judge**: GDP impact modeling + trade balance delta + supply chain resilience score
*   **Self-Creation**: WTO arbitrator agents, secondary-sanction enforcer agents, black-market intermediary agents

### I. AI Safety Red-Teaming & Alignment Debate
*   **Agents**: "Deploy" advocate (capabilities-first), "Pause" advocate (safety-first), regulator agent
*   **State**: Deployment policy terms (compute thresholds, eval benchmarks required, monitoring scope, incident response SLA)
*   **Judge**: Risk-adjusted utility: capability unlocked × (1 − catastrophic risk probability)
*   **Self-Creation**: Whistleblower agents, independent auditor agents, public-interest advocate agents

### J. Hostage & Crisis Negotiation Training
*   **Agents**: Hostage negotiator, hostage-taker, on-scene commander
*   **State**: Demands (ransom amount, safe passage, media access), hostage status, perimeter conditions, elapsed time
*   **Judge**: Hostage survival probability + demands containment + resolution speed
*   **Self-Creation**: Psychologist profiler agents, tactical team liaison agents, media blackout enforcer agents

### K. Academic Peer Review & Funding Allocation
*   **Agents**: Research groups competing for a fixed grant pool, review committee members with domain biases
*   **State**: Grant allocation splits, publication slots, lab resource assignments, co-authorship agreements
*   **Judge**: Scientific merit score + funding efficiency + conflict-of-interest penalty
*   **Self-Creation**: Ethics review board agents, external referee agents, interdisciplinary bridge agents

## 3. Good Fit With Adaptation ⚠️

These use cases can work but require meaningful extensions to the core framework:

### A. Market Impact Modeling
*   **How it maps**: Market actors (central banks, hedge funds, regulators) as agents, market state (interest rates, asset prices, liquidity) as the `StateObject`
*   **Adaptation required**: The execution loop may need to shift from strict turn-based to event-driven to model market reactions in real time. The Judge would need to evaluate portfolio performance rather than negotiation outcomes.

### B. Human-in-the-Loop Strategy Training
*   **How it maps**: AI agents simulate stakeholders, a human plays one of the roles
*   **Adaptation required**: The framework's `ActorAgent` class must be extended with a `HumanActorAgent` subclass that prompts for real human input instead of calling an LLM. The Mutator would only evolve the AI opponent, not the human.

### C. Organizational Decision-Making Simulation
*   **How it maps**: C-suite executives, board members, shareholders as agents negotiating corporate strategy
*   **Adaptation required**: The `GenericStateObject` must encode hierarchical authority — some agents' votes carry more weight than others. The framework currently treats all Primary Actors as equals.

### D. Competitive Creative Writing / Adversarial Content Generation
*   **How it maps**: Two "poet agents" or "storyteller agents" with competing styles (e.g., minimalist vs. maximalist). The `StateObject` tracks the evolving piece (draft text, structural parameters like word count, meter adherence, thematic keywords).
*   **Judge**: Literary competitions score creative work routinely. The Judge can use rubrics: technical proficiency (meter, rhyme, form adherence), emotional resonance, originality, vocabulary richness. LLM-as-a-judge is already well-established for creative evaluation (e.g., Chatbot Arena, LMSYS).
*   **Adaptation required**: The `StateObject` shifts from negotiation parameters to creative constraints (e.g., syllable count, thematic requirements). The Judge's rubric must be domain-specific.

### E. Multi-Stakeholder Platform Governance (Content Moderation)
*   **How it maps**: A "Platform Safety" agent, a "Provisioner Freedom" agent, and an "Advertiser Risk" agent negotiate content moderation policies. The `StateObject` encodes policy thresholds (hate speech classifier sensitivity, appeal window duration, monetization eligibility criteria).
*   **Adaptation required**: The turn model must support **asymmetric authority** — the Platform agent can unilaterally enact emergency policy overrides (akin to `abort_episode` but for a single policy field). The Judge needs dual metrics: user safety score + creator retention rate.

### F. Healthcare Triage & Ethics Committee Simulation
*   **How it maps**: Physician agent, hospital administrator agent, and patient advocate agent negotiate resource allocation under scarcity (ventilators, organ transplant priority, experimental treatment access). The `StateObject` tracks patient queue rankings, resource inventory, and ethical framework parameters (utilitarian vs. deontological weights).
*   **Adaptation required**: The `StateObject` must support **time-decaying urgency** — patient conditions worsen each turn, adding a dynamic cost to stalling. The Judge must balance medical outcome optimization against ethical constraint adherence.

### G. Cybersecurity Attack/Defense Wargaming
*   **How it maps**: Red team (attacker) agent vs. Blue team (defender) agent in a structured network environment. The `StateObject` tracks network topology, compromised nodes, deployed patches, and detection alerts.
*   **Adaptation required**: The execution loop needs **information asymmetry** — the Red team's state mutations (lateral movement, privilege escalation) are hidden from the Blue team until a detection threshold is crossed. The Judge scores Red on objectives achieved (data exfiltrated, persistence maintained) and Blue on mean-time-to-detect + containment effectiveness.

### H. Auction & Procurement Strategy
*   **How it maps**: Multiple bidder agents competing for contracts, a procurement officer agent setting terms. The `StateObject` tracks bid amounts, compliance requirements, delivery timelines, and evaluation weights.
*   **Adaptation required**: The framework's dialogue model must support **sealed-bid rounds** where agents submit proposals without seeing competitors' bids. The turn structure shifts from conversational to submission-based with reveal phases. The Judge scores on total procurement value + quality compliance.

## 4. Not Designed For ❌

These use cases require a fundamentally different architecture:

### A. Self-Creating Software (Autonomous Code Generation)
*   **Why not**: This framework creates **agents** (LLM prompt configurations with goals, strategies, and permissions). It does NOT write arbitrary production code (React components, APIs, databases). The Provisioner designs a new *negotiator* or *observer* — it does not generate executable software artifacts.
*   **What to use instead**: Autonomous coding agents (e.g., Devin-style architectures, code-generation pipelines with test-driven feedback loops).

### B. Single-Agent Tasks
*   **Why not**: The framework is fundamentally built around *multi-agent interaction*. A single agent optimizing a prompt in isolation would use only the Mutator and Judge, bypassing the Environment, Disruptors, Capitalizer, and Provisioner entirely — effectively wasting 80% of the architecture.
*   **What to use instead**: Standard prompt optimization frameworks (e.g., DSPy, TextGrad).

### C. Real-Time Continuous Systems
*   **Why not**: The framework operates on a discrete, turn-based execution loop. Agents take turns. Real-time systems (e.g., autonomous driving, live trading bots) require continuous-time decision-making with no concept of "turns."
*   **What to use instead**: Reinforcement Learning environments (e.g., OpenAI Gym, PettingZoo for multi-agent RL).

## 5. Decision Flowchart

To determine if your use case fits, answer these questions:

1.  **Do you have 2+ entities with distinct, potentially conflicting goals?**
    *   No → ❌ Use a single-agent optimization framework
    *   Yes → Continue
2.  **Can the interaction state be represented as a structured JSON object that changes over time?**
    *   No → ❌ The framework requires a formal `GenericStateObject`
    *   Yes → Continue
3.  **Can you define a scoring function that objectively evaluates the final state?**
    *   No → ❌ The Mutator cannot improve without a measurable signal
    *   Yes → ✅ **This framework is designed for your use case**
