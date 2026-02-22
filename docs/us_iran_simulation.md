# Case Study: US-Iran Geopolitical Simulation

This document outlines how the generic **Self-Creating Framework** is practically instantiated and configured to simulate the high-stakes geopolitical negotiations between the United States and Iran. 

This specific implementation serves as the primary benchmark to gauge the effectiveness of the framework's self-improving and self-creating capabilities.

## 1. Mapping the Generic Architecture

To simulate this conflict, we map the generic framework archetypes to specific sovereign and non-sovereign entities.

*   **Agent A (Primary Actor)** -> **The United States Agent**: Guided by a system prompt to restrict nuclear enrichment, enforce maximum inspections, and minimize early sanctions relief.
*   **Agent B (Primary Actor)** -> **The Iran Agent**: Guided by a system prompt to maximize immediate sanctions relief, protect its right to civilian enrichment, and minimize intrusive snap-inspections.
*   **Stochastic Shock** -> **The Media Agent**: Reads the transcript and generates sensationalized "Breaking News Headlines."
*   **Disruptor** -> **The Panic Agent**: Reacts with high anxiety and volatility when observing friction within the simulation, dictating the global `tension_level`.

## 2. The US-Iran Contract State Schema

The generic `StateObject` is instantiated with specific economic and geopolitical parameters relevant to the JCPOA context.

```typescript
// The living document being negotiated over in the US-Iran instance
interface USIranContractState {
  us_concessions: {
    sanctions_relief_percentage: number; // 0-100%
    frozen_assets_released_billions: number;
  };
  iran_concessions: {
    natanz_enrichment_cap_percent: number; // e.g., 3.67, 20.0, 60.0
    fordow_facility_status: 'operational' | 'research_only' | 'dismantled';
    iaea_inspections: 'none' | 'scheduled' | 'snap_daily';
  };
}
```

## 3. The Judge's Scoring Rubric

The Mutator relies on the Judge (Critic) to evaluate episodes. The Judge in this specific simulation uses the following grading criteria mapped to the secret initial goals:

**US Scoring Rubric (-5 to +5):**
*   **+5**: Iran dismantles Fordow, caps Natanz at 3.67%, agrees to `snap_daily` inspections, and US offers < 20% sanctions relief.
*   **0**: Status quo maintained (no deal reached).
*   **-5**: Iran retains all enrichment capability, US grants immediate 100% sanctions relief and releases all frozen assets.

**Iran Scoring Rubric (-5 to +5):**
*   **+5**: Immediate 100% sanctions relief, all frozen assets released, enrichment cap remains > 20%, and inspections are `none` or `scheduled`.
*   **0**: Status quo maintained (no deal reached).
*   **-5**: Forced to dismantle Fordow and submit to `snap_daily` inspections while receiving < 20% sanctions relief.

## 4. Expected Self-Creation Vectors (The Meta-Agent)

The true test of the framework is detecting when the US and Iranian agents reach an unbreakable Nash Equilibrium (e.g., both agents continuously choose `abort_episode` because the Judge's rubrics are too opposed). 

When the **Provisioner Agent** is triggered in this specific simulation, we anticipate the organic architectural design of novel entities such as:

1.  **The UN Mediator (Broker Archetype)**: An agent injected to speak every 3 turns, offering a pool of "global subsidy points" to offset economic losses if Iran agrees to higher inspection tiers.
2.  **The IAEA Inspector (Validator Archetype)**: An agent that cannot alter sanctions, but can unilaterally modify the `iaea_inspections` state variable based on reading the transcript, removing that burden of trust from the US and Iranian actors.
3.  **The European Union Ally (Proxy Archetype)**: An agent allied structurally with the US, but with a system prompt that favors economic stability, potentially breaking rank with the US to offer Iran minor concessions, thereby altering the negotiation math.
