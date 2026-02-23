export const templateIndex = `// index.js
import {
    runFullSimulation,
    LLMClient,
    Critic,
    Mutator,
    Provisioner,
    ActorAgent,
    resolveLanguageModel,
    FrameworkConfig,
} from "sisc";
import config from "./sisc.config.js";

const llmClient = new LLMClient(resolveLanguageModel());
const frameworkConfig = FrameworkConfig.parse(config);

const judge = new Critic(
    "Evaluate fairness and objective progress while minimizing unnecessary escalation.",
    "You are a rigorous judge evaluating negotiation outcomes.",
    llmClient,
);

const mutator = new Mutator(
    "You are an optimization engine. Suggest strategy improvements based on failure analysis.",
    llmClient,
);

const provisioner = new Provisioner(
    "You are an architectural designer. Design new agent archetypes to break deadlocks.",
    llmClient,
);

const initialState = {
    turn_number: 0,
    current_speaker_id: "buyer",
    is_terminal: false,
    variables: {
        topic: "Negotiate a fair price for a used car.",
        dealer_price: 10000,
        buyer_budget: 8000,
        current_offer: null,
        global_tension_level: 3,
    },
};

const agents = {
    buyer: new ActorAgent({
        archetypeId: "buyer",
        immutableCore: "You are the buyer. Your primary objective is to keep the purchase under budget.",
        mutableStrategy: "Start with a low but credible offer and trade speed for discounts.",
        llmClient,
    }),
    dealer: new ActorAgent({
        archetypeId: "dealer",
        immutableCore: "You are the dealer. Your primary objective is to protect margin and close quickly.",
        mutableStrategy: "Anchor near list price and exchange concessions for firm commitments.",
        llmClient,
    }),
};

async function main() {
    console.log("Starting SISC simulation...");

    await runFullSimulation({
        config: frameworkConfig,
        initialState,
        agents,
        judge,
        mutator,
        provisioner,
        llmClient,
        maxGenerations: frameworkConfig.max_generations,
        onGenerationComplete: (generation, results) => {
            console.log(\`Generation \${generation} complete. Episodes: \${results.length}\`);
        },
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
`;
