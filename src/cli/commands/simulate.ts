import * as p from "@clack/prompts";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import {
    LLMClient,
    runFullSimulation,
    ActorAgent,
    Critic,
    Mutator,
    Provisioner,
    resolveLanguageModel,
} from "../../index.js";

interface ScenarioActor {
    id: string;
    name: string;
    role: string;
    personality: string;
    immutableCore: string;
}

interface Scenario {
    name: string;
    description: string;
    context: string;
    initialState: {
        variables: Record<string, any>;
    };
    actors: ScenarioActor[];
    config: {
        epoch_size: number;
        max_turns_per_episode: number;
        max_generations: number;
        improvement_margin: number;
    };
}

async function createInteractiveScenario(): Promise<Scenario | null> {
    const name = await p.text({
        message: "Enter simulation name:",
        placeholder: "US vs Iran Geopolitical Tension",
        validate: (v) => v && v.length < 3 ? "Name is too short." : undefined,
    });
    if (p.isCancel(name)) return null;

    const description = await p.text({
        message: "Enter description:",
        placeholder: "A simulation of escalating maritime and diplomatic tensions...",
    });
    if (p.isCancel(description)) return null;

    const context = await p.text({
        message: "Enter starting context:",
        placeholder: "Recent incidents in the Strait of Hormuz...",
    });
    if (p.isCancel(context)) return null;

    const actors: ScenarioActor[] = [];
    let addMore = true;
    while (addMore || actors.length < 2) {
        const count = actors.length + 1;
        p.log.step(`Define Actor #${count}${actors.length < 2 ? " (Minimum 2 required)" : ""}`);
        const actorName = await p.text({ message: `Actor Name:`, placeholder: `Actor ${count}` });
        if (p.isCancel(actorName)) return null;

        const actorRole = await p.text({ message: "Actor Role:", placeholder: "Strategic Stakeholder" });
        if (p.isCancel(actorRole)) return null;

        const personality = await p.text({ message: "Actor Personality:", placeholder: "Calculated, firm..." });
        if (p.isCancel(personality)) return null;

        const core = await p.text({ message: "Immutable Core Directive:", placeholder: `You are the ${actorName} representative...` });
        if (p.isCancel(core)) return null;

        actors.push({
            id: actorName.toLowerCase().replace(/\s+/g, "_"),
            name: actorName,
            role: actorRole,
            personality,
            immutableCore: core,
        });

        if (actors.length >= 2) {
            const more = await p.confirm({
                message: "Add another actor?",
                initialValue: false,
            });
            if (p.isCancel(more) || !more) addMore = false;
        }
    }

    const scenario: Scenario = {
        name: name as string,
        description: description as string,
        context: context as string,
        initialState: {
            variables: {
                global_tension_level: 5,
            }
        },
        actors,
        config: {
            epoch_size: 2,
            max_turns_per_episode: 6,
            max_generations: 3,
            improvement_margin: 0.1
        }
    };

    const save = await p.confirm({
        message: "Would you like to save this scenario to the scenarios/ directory?",
        initialValue: true,
    });

    if (save && !p.isCancel(save)) {
        const filename = `${scenario.name.toLowerCase().replace(/\s+/g, "-")}.json`;
        const dir = path.join(process.cwd(), "scenarios");
        try {
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(path.join(dir, filename), JSON.stringify(scenario, null, 2));
            p.log.success(`Scenario saved to ${chalk.cyan(path.join("scenarios", filename))}`);
        } catch (err) {
            p.log.error("Failed to save scenario file.");
        }
    }

    return scenario;
}

export async function simulateCommand(options: { scenario?: string }) {
    p.intro(chalk.bgCyan.black(" SISC - No-Code Simulation "));

    const scenariosDir = path.join(process.cwd(), "scenarios");
    let scenario: Scenario | null = null;

    if (options.scenario) {
        const scenarioPath = path.resolve(process.cwd(), options.scenario);
        try {
            const content = await fs.readFile(scenarioPath, "utf-8");
            scenario = JSON.parse(content);
        } catch (err) {
            p.log.error(chalk.red(`Failed to load scenario from ${options.scenario}`));
            process.exit(1);
        }
    } else {
        const files = await fs.readdir(scenariosDir).catch(() => []);
        const jsonFiles = files.filter(f => f.endsWith(".json"));

        const choices = jsonFiles.map(f => ({ label: f, value: path.join(scenariosDir, f) }));
        choices.unshift({ label: chalk.green("+ Create New Scenario (Q&A)"), value: "CREATE_NEW" });

        const selection = await p.select({
            message: "Select a simulation scenario or create a new one:",
            options: choices,
        });

        if (p.isCancel(selection)) {
            p.outro("Simulation cancelled.");
            process.exit(0);
        }

        if (selection === "CREATE_NEW") {
            scenario = await createInteractiveScenario();
            if (!scenario) {
                p.outro("Simulation cancelled.");
                process.exit(0);
            }
        } else {
            try {
                const content = await fs.readFile(selection as string, "utf-8");
                scenario = JSON.parse(content);
            } catch (err) {
                p.log.error(chalk.red("Failed to load selected scenario."));
                process.exit(1);
            }
        }
    }

    if (!scenario) {
        p.log.error(chalk.red("No scenario provided."));
        process.exit(1);
    }

    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        p.log.error(chalk.red("No LLM API key detected. Please set OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY."));
        process.exit(1);
    }

    p.log.info(chalk.bold(`Scenario: ${scenario.name}`));
    p.log.info(chalk.dim(scenario.description));
    p.log.step("Initializing framework components...");

    try {
        const model = resolveLanguageModel();
        const llmClient = new LLMClient(model);

        const activeAgents: Record<string, ActorAgent> = {};
        for (const actor of scenario.actors) {
            activeAgents[actor.id] = new ActorAgent({
                archetypeId: actor.id,
                immutableCore: actor.immutableCore,
                mutableStrategy: "",
                llmClient,
            });
        }

        const judgeSystemPrompt = "You are an impartial, mathematically rigorous evaluator. You have no allegiance to any agent. You evaluate OUTCOMES, not intentions.";
        const judge = new Critic(
            "Evaluate based on strategic depth, adherence to goals, and avoidance of unnecessary destructive escalation unless aligned with core interests.",
            judgeSystemPrompt,
            llmClient
        );

        const mutatorSystemPrompt = "You are an expert AI Strategist and Prompt Engineer. Your objective is to review a failed simulation episode and generate exactly THREE new, distinct strategic tactics.";
        const mutator = new Mutator(mutatorSystemPrompt, llmClient);

        const provisionerSystemPrompt = "You are a Macro-Systems Architect. The primary negotiation environment is fundamentally deadlocked. Your objective is to design, provision, and deploy a brand new Agent.";
        const provisioner = new Provisioner(provisionerSystemPrompt, llmClient);

        p.log.success("Environment ready.");

        const startSimulation = await p.confirm({
            message: "Start the self-improvement simulation?",
        });

        if (p.isCancel(startSimulation) || !startSimulation) {
            p.outro("Simulation aborted.");
            process.exit(0);
        }

        const simSpinner = p.spinner();
        simSpinner.start("Simulation in progress...");

        await runFullSimulation({
            config: {
                ...scenario.config,
                max_active_created_agents: 3,
                creation_patience: 1,
                shadow_trial_count: 2,
                summarization_frequency: 5,
                info_disruptor_frequency: 3,
                require_human_approval_for_creation: false,
            } as any,
            initialState: scenario.initialState as any,
            agents: activeAgents,
            judge,
            mutator,
            provisioner,
            llmClient,
            onGenerationComplete: (gen, results) => {
                const allScores = results.flatMap(r => Object.values(r[1]));
                const avgTotal = allScores.reduce((sum, val) => sum + val, 0) / allScores.length;
                simSpinner.message(`Gen ${gen}: Global Performance Mean: ${avgTotal.toFixed(2)}`);
            },
            onTurnComplete: (speakerId, dialogue) => {
                // Determine color based on index in actor list or simplified mapping
                const colors = [chalk.blue, chalk.green, chalk.yellow, chalk.cyan, chalk.magenta];
                const index = Object.keys(activeAgents).indexOf(speakerId);
                const color = index !== -1 ? colors[index % colors.length] : chalk.white;

                p.log.message(`${color.bold(speakerId)}: ${chalk.white(dialogue)}`);
            },
            onAgentCreated: (agentId, archetype) => {
                p.log.warn(`${chalk.magenta.bold("PROVISIONER")}: Birthed new agent ${chalk.cyan(agentId)} (${archetype})`);
            },
        });

        simSpinner.stop(chalk.green("Simulation completed."));
        p.outro("Self-improvement cycle finished.");

    } catch (err) {
        p.log.error(chalk.red("Simulation error:"));
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}
