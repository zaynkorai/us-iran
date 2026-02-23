/**
 * Context Management — Tiered context pruning to mitigate context window pressure.
 *
 * @see docs/context_management_and_summarization.md — Full protocol
 */
import type { GenericStateObject } from "../schemas/state.js";
import type { ActionLogEntry } from "../agents/capitalizer.js";

/**
 * The triage context tiers:
 *   Tier 1: System Prompt + Strategy — Immutable, never pruned
 *   Tier 2: Current StateObject + Last 3 turns — Full resolution
 *   Tier 3: Turns 4–10 — High-level bullet points
 *   Tier 4: Everything older than 10 turns — Recursive summary
 *
 * @see docs/context_management_and_summarization.md §1
 */
export interface TriageContext {
    /** Tier 2: Full resolution recent turns. */
    recentTurns: ActionLogEntry[];
    /** Tier 3: Condensed summaries of turns 4-10. */
    condensedRecent: string[];
    /** Tier 4: Recursive summary of deep history. */
    deepHistorySummary: string;
}

/**
 * Build a triage context for an agent, pruning old turns to control token usage.
 *
 * @see docs/context_management_and_summarization.md §1 — Multi-Tiered Context Stack
 */
export function buildTriageContext(
    actionLogs: ActionLogEntry[],
    _agentId: string,
): TriageContext {
    // Tier 2: Last 3 turns — full resolution
    const recentTurns = actionLogs.slice(-3);

    // Tier 3: Turns 4–10 — high-level bullet points
    const midRange = actionLogs.slice(-10, -3);
    const condensedRecent = midRange.map(
        (log) => `Turn ${log.turn}: ${log.speakerId} — ${(log.public_dialogue as string || "").slice(0, 100)}`,
    );

    // Tier 4: Everything older — recursive summary
    const oldLogs = actionLogs.slice(0, -10);
    const deepHistorySummary =
        oldLogs.length > 0
            ? `[Summary of ${oldLogs.length} earlier turns: Negotiation covered topics including state mutations and strategic exchanges.]`
            : "";

    return { recentTurns, condensedRecent, deepHistorySummary };
}

/**
 * Classify state fields by recency of mutation.
 *
 * @see docs/context_management_and_summarization.md §3 — Semantic State Pruning
 */
export interface FieldClassification {
    hot: string[];   // mutated in last 2 turns
    warm: string[];  // mutated in last 5 turns
    cold: string[];  // untouched for >10 turns
}

export function classifyStateFields(
    actionLogs: ActionLogEntry[],
    currentTurn: number,
): FieldClassification {
    const lastMutated: Record<string, number> = {};

    for (const log of actionLogs) {
        if (log.state_mutations && Array.isArray(log.state_mutations)) {
            for (const mutation of log.state_mutations as Array<{ path: string }>) {
                lastMutated[mutation.path] = log.turn;
            }
        }
    }

    const hot: string[] = [];
    const warm: string[] = [];
    const cold: string[] = [];

    for (const [path, lastTurn] of Object.entries(lastMutated)) {
        const age = currentTurn - lastTurn;
        if (age <= 2) hot.push(path);
        else if (age <= 5) warm.push(path);
        else cold.push(path);
    }

    return { hot, warm, cold };
}

/**
 * Filter an agent's own internal monologues, applying recency bias.
 * Agents only see their own last 2 monologues.
 *
 * @see docs/context_management_and_summarization.md §4 — Pruning Internal Monologues
 */
export function pruneMonologues(
    actionLogs: ActionLogEntry[],
    agentId: string,
): string[] {
    const agentLogs = actionLogs
        .filter((log) => log.speakerId === agentId && log.internal_monologue)
        .map((log) => log.internal_monologue as string);

    // Only the last 2 monologues
    return agentLogs.slice(-2);
}
