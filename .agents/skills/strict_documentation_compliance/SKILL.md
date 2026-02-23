---
name: strict_documentation_compliance
description: Ensures all implementation decisions, code generation, and architectural changes strictly adhere to the established project documentation.
---

# Strict Documentation Compliance Skill

This skill enforces rigorous alignment between the source code implementation and the theoretical and technical architecture defined in the project's `docs/` directory.

## 🚨 The Golden Rule
**The `docs/` folder is the single source of truth.** If an instruction, requested feature, or logic contradicts the documentation, the documentation wins. Do not hallucinate generic agent frameworks or external infrastructure.

## Core Directives

### 1. Mandatory Pre-Flight Checks
Before generating, refactoring, or reviewing implementation code, you MUST use the `view_file` or `grep_search` tools to consult the relevant documentation. 
* *Building classes?* Read `docs/engineering_implementation.md`.
* *Adding mathematical evaluations?* Read `docs/evaluation_and_math.md`.
* *Implementing tools or safety limits?* Read `docs/safety_and_sandboxing.md`.
* *Defining the execution loop?* Read `docs/system_architecture.md`.

### 2. Strict Zod Schema Compliance
ALL generated inputs, outputs, state mutations, and internal object types must exactly mirror the Zod schemas provided in the documentation (e.g., `ActionProposal`, `NewAgentProvisioning`, `FrameworkConfig`). Do not invent new fields or omit required ones without first updating the documentation via a formal proposal.

### 3. Safety and Sandboxing Inviolability
Any dynamically generated execution or tool logic MUST follow the Application-Layer sandboxing rules:
* Never use `eval()`. Use `JSON.parse()` for object deserialization.
* If dynamic execution is necessary, use a severely restricted `vm.createContext()`.
* Ensure `EnvironmentManager` catches `ZodError` exceptions and fails gracefully (penalizing the agent's turn rather than crashing).

### 4. Technical Constraints (KISS Principle)
The project is designed as a clean, portable Native TypeScript Library.
* **DO NOT** reach for heavy overhead tools like Redis, Kafka, or Docker swarms just to manage state.
* In-memory native JS objects are vastly preferred for turn execution.
* Use `pnpm` exclusively for package management tasks.

### 5. Architectural Correctness
* **No Unapproved Meta-Agents**: Ensure only the core Agent Taxonomy (Actors, Disruptors, Judge, Mutator, Provisioner, Explorer) is implemented unless formal evolution dictates otherwise.
* **Self-Improvement Rigor**: Any mutation logic implementation MUST follow the multi-armed bandit (Shadow Trials) and Mann-Whitney U test validation (Red Queen co-evolution) mathematics. 

## Implementation Output Rules
When writing code, you are encouraged to leave inline comments explicitly citing the documentation rule that dictated the logic.
*Example: `// Enforced by docs/safety_and_sandboxing.md Section 3: Hard Token Limits`*
