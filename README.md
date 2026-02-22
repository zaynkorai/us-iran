# The Self-Improving Framework

A **Framework** for building **Self-Improving** and **Self-Creating** LLM agents.

This repository contains two core components:

1. **The Generic Framework**: A domain agnostic, event-driven engine designed to simulate high-stakes environments where diverse AI agents must navigate conflicting goals, reflect, adapt, and autonomously architect entirely new agents to break systemic deadlocks.
2. **The US-Iran Case Study**: A specific geopolitical simulation implemented using the framework to gauge its effectiveness in a highly polarized, multi-agent adversarial setting.

## Documentation Index

This is a highly modular framework. Read the documentation in this order to understand how self-improving and self-creating agents are built.

### 1. Phase 1: Core Theory & Mechanics 🧠
*Understanding the "What" and "How" of the system.*
*   [**System Architecture**](./docs/system_architecture.md) — The 8-step Execution Loop and agent taxonomy.
*   [**Agent Design & State**](./docs/agent_design_and_state.md) — The `EnvironmentState` payload and JSON output schemas.
*   [**Self-Creation Mechanics**](./docs/self_creation_mechanics.md) — How systemic deadlocks trigger the dynamic architecting of new agents (The Provisioner).
*   [**The Self-Improvement Loop**](./docs/self_improvement_loop.md) — The Actor-Critic pipeline, shadow trials, and monotonic non-decreasing math.

### 2. Phase 2: System Implementation ⚙️
*How to build the infrastructure.*
*   [**Data & Memory Schemas**](./docs/data_and_memory_schemas.md) — SQLite logic, schema versioning, indexing, and RomaDB/FAISS vector retrieval.
*   [**Core System Prompts**](./docs/core_system_prompts.md) — The Tripartite Architecture (Immutable/Mutable/Dynamic) and full prompts for all Meta-Agents.
*   [**API & Interfaces**](./docs/api_and_interfaces.md) — The developer contracts and 3-level error-handling fallbacks.
*   [**Engineering Implementation**](./docs/engineering_implementation.md) — TypeScript core library, Zod schemas, and complete method body pseudocode.

### 3. Phase 3: Safety & Evaluation 🛡️
*How to control and measure the agents.*
*   [**Evaluation & Math**](./docs/evaluation_and_math.md) — The discrete `-5` to `+5` scoring rubric and rigorous A/B testing thresholds.
*   [**Safety & Sandboxing**](./docs/safety_and_sandboxing.md) — Defending against Arbitrary Code Execution, DoS, and prompt injection (includes complete Test Plan).

### 4. Phase 4: Applied Use Cases & Meta-Agents 🌐
*Seeing it in action and exploring specialized asynchronous agents.*
*   [**Applicability Matrix**](./docs/applicability_matrix.md) — 11 perfect-fit domains, 8 adaptable domains, and 3 anti-patterns for this framework.
*   [**US-Iran Simulation**](./docs/us_iran_simulation.md) — The geopolitical benchmark case study mapping abstract agents to real-world entities.
*   [**Explorer Agent**](./docs/explorer_agent.md) — The outward-looking "Possibility Researcher" that synthesis convergence hypotheses.
*   [**Capitalizer Agent**](./docs/capitalizer_agent.md) — The Interjector that eavesdrops on internal monologues to calculate hidden overlaps.

