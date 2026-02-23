export const templateAgent = `// agents/MyActor.js
import { ActorAgent } from "sisc";

/**
 * Example factory for creating a custom actor with your own immutable core and strategy.
 */
export function createMyActor(id, llmClient) {
    return new ActorAgent({
        archetypeId: id,
        immutableCore: "You are a pragmatic negotiator focused on durable agreements.",
        mutableStrategy: "Prioritize high-value concessions and avoid deadlocks.",
        llmClient,
    });
}
`;
