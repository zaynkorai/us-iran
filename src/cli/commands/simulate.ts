import * as p from "@clack/prompts";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { z } from "zod/v4";
import {
    LLMClient,
    runFullSimulation,
    ActorAgent,
    Critic,
    Mutator,
    Provisioner,
    resolveLanguageModel,
    FrameworkConfig,
    GenericStateObject,
} from "../../index.js";

const ScenarioActorSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string().min(1),
    personality: z.string().min(1),
    immutableCore: z.string().min(1),
});

const ScenarioSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    context: z.string().min(1),
    initialState: z.object({
        variables: z.record(z.string(), z.any()),
        turn_number: z.number().int().optional(),
        current_speaker_id: z.string().optional(),
        is_terminal: z.boolean().optional(),
        scout_hypotheses: z.array(z.object({
            title: z.string(),
            feasibility_score: z.number().int().min(1).max(10),
            disruption_target: z.string(),
        })).optional(),
        injections: z.record(z.string(), z.any()).optional(),
    }),
    actors: z.array(ScenarioActorSchema).min(2)
        .superRefine((actors, ctx) => {
            const seen = new Set<string>();
            for (let i = 0; i < actors.length; i++) {
                const id = actors[i].id;
                if (seen.has(id)) {
                    ctx.addIssue({
                        code: "custom",
                        message: `Duplicate actor id: ${id}`,
                        path: [i, "id"],
                    });
                }
                seen.add(id);
            }
        }),
    config: FrameworkConfig.partial().default({}),
    prompts: z.object({
        judge_rubric: z.string(),
        judge_system_prompt: z.string(),
        mutator_system_prompt: z.string(),
        provisioner_system_prompt: z.string(),
    }).partial().default({}),
    runtime: z.object({
        provider: z.string(),
        model: z.string(),
    }).partial().default({}),
});

type Scenario = z.infer<typeof ScenarioSchema>;

interface SimulateOptions {
    scenario?: string;
    provider?: string;
    model?: string;
    maxGenerations?: string;
    yes?: boolean;
}

function ensureApiKeyPresent(): void {
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        throw new Error("No LLM API key detected. Please set OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY.");
    }
}

function buildInitialState(scenario: Scenario): z.infer<typeof GenericStateObject> {
    return GenericStateObject.parse({
        turn_number: scenario.initialState.turn_number ?? 0,
        current_speaker_id: scenario.initialState.current_speaker_id ?? scenario.actors[0].id,
        is_terminal: scenario.initialState.is_terminal ?? false,
        scout_hypotheses: scenario.initialState.scout_hypotheses,
        injections: scenario.initialState.injections,
        variables: scenario.initialState.variables,
    });
}

async function loadScenarioFromFile(filePath: string): Promise<Scenario> {
    const content = await fs.readFile(filePath, "utf-8");
    return ScenarioSchema.parse(JSON.parse(content));
}

async function selectScenarioFile(scenariosDir: string): Promise<string | "CREATE_NEW" | null> {
    const files = await fs.readdir(scenariosDir).catch(() => []);
    const jsonFiles = files.filter(f => f.endsWith(".json"));

    const choices = jsonFiles.map(f => ({ label: f, value: path.join(scenariosDir, f) }));
    choices.unshift({ label: chalk.green("+ Create New Scenario (Q&A)"), value: "CREATE_NEW" });

    const selection = await p.select({
        message: "Select a simulation scenario or create a new one:",
        options: choices,
    });

    if (p.isCancel(selection)) return null;
    return selection as string | "CREATE_NEW";
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

    const actors: Array<z.infer<typeof ScenarioActorSchema>> = [];
    let addMore = true;
    while (addMore || actors.length < 2) {
        const count = actors.length + 1;
        p.log.step(`Define Actor #${count}${actors.length < 2 ? " (Minimum 2 required)" : ""}`);
        const actorName = await p.text({ message: "Actor Name:", placeholder: `Actor ${count}` });
        if (p.isCancel(actorName)) return null;

        const actorRole = await p.text({ message: "Actor Role:", placeholder: "Strategic Stakeholder" });
        if (p.isCancel(actorRole)) return null;

        const personality = await p.text({ message: "Actor Personality:", placeholder: "Calculated, firm..." });
        if (p.isCancel(personality)) return null;

        const core = await p.text({ message: "Immutable Core Directive:", placeholder: `You are the ${actorName} representative...` });
        if (p.isCancel(core)) return null;

        actors.push({
            id: String(actorName).toLowerCase().replace(/\s+/g, "_"),
            name: String(actorName),
            role: String(actorRole),
            personality: String(personality),
            immutableCore: String(core),
        });

        if (actors.length >= 2) {
            const more = await p.confirm({
                message: "Add another actor?",
                initialValue: false,
            });
            if (p.isCancel(more) || !more) addMore = false;
        }
    }

    const scenario = ScenarioSchema.parse({
        name,
        description,
        context,
        initialState: { variables: { global_tension_level: 5 } },
        actors,
        config: {
            epoch_size: 2,
            max_turns_per_episode: 6,
            max_generations: 3,
            improvement_margin: 0.1,
        },
        prompts: {},
        runtime: {},
    });

    const save = await p.confirm({
        message: "Would you like to save this scenario to the scenarios/ directory?",
        initialValue: true,
    });

    if (save && !p.isCancel(save)) {
        const filename = `${scenario.name.toLowerCase().replace(/\s+/g, "-")}.json`;
        const dir = path.join(process.cwd(), "scenarios");
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, filename), JSON.stringify(scenario, null, 2));
        p.log.success(`Scenario saved to ${chalk.cyan(path.join("scenarios", filename))}`);
    }

    return scenario;
}

async function resolveScenario(options: SimulateOptions, scenariosDir: string): Promise<Scenario | null> {
    if (options.scenario) {
        const scenarioPath = path.resolve(process.cwd(), options.scenario);
        return loadScenarioFromFile(scenarioPath);
    }

    const selection = await selectScenarioFile(scenariosDir);
    if (!selection) return null;

    if (selection === "CREATE_NEW") {
        return createInteractiveScenario();
    }

    return loadScenarioFromFile(selection);
}

export async function simulateCommand(options: SimulateOptions) {
    p.intro(chalk.bgCyan.black(" SISC - No-Code Simulation "));

    const scenariosDir = path.join(process.cwd(), "scenarios");

    try {
        const scenario = await resolveScenario(options, scenariosDir);
        if (!scenario) {
            p.outro("Simulation cancelled.");
            return;
        }

        ensureApiKeyPresent();

        p.log.info(chalk.bold(`Scenario: ${scenario.name}`));
        p.log.info(chalk.dim(scenario.description));
        p.log.step("Initializing framework components...");

        const selectedProvider = options.provider ?? scenario.runtime.provider;
        const selectedModel = options.model ?? scenario.runtime.model;
        const model = resolveLanguageModel(selectedProvider, selectedModel);
        const llmClient = new LLMClient(model);

        const frameworkConfig = FrameworkConfig.parse(scenario.config);
        const maxGenerationsOverride = options.maxGenerations
            ? Number(options.maxGenerations)
            : undefined;
        if (Number.isNaN(maxGenerationsOverride)) {
            throw new Error(`Invalid --max-generations value: ${options.maxGenerations}`);
        }
        const maxGenerations = maxGenerationsOverride ?? frameworkConfig.max_generations;

        const activeAgents: Record<string, ActorAgent> = {};
        for (const actor of scenario.actors) {
            activeAgents[actor.id] = new ActorAgent({
                archetypeId: actor.id,
                immutableCore: actor.immutableCore,
                mutableStrategy: "",
                llmClient,
            });
        }

        const judge = new Critic(
            scenario.prompts.judge_rubric ?? "Evaluate based on strategic depth, adherence to goals, and avoidance of unnecessary destructive escalation unless aligned with core interests.",
            scenario.prompts.judge_system_prompt ?? "You are an impartial, mathematically rigorous evaluator. You have no allegiance to any agent. You evaluate OUTCOMES, not intentions.",
            llmClient,
        );
        const mutator = new Mutator(
            scenario.prompts.mutator_system_prompt ?? "You are an expert AI Strategist and Prompt Engineer. Your objective is to review a failed simulation episode and generate exactly THREE new, distinct strategic tactics.",
            llmClient,
        );
        const provisioner = new Provisioner(
            scenario.prompts.provisioner_system_prompt ?? "You are a Macro-Systems Architect. The primary negotiation environment is fundamentally deadlocked. Your objective is to design, provision, and deploy a brand new Agent.",
            llmClient,
        );

        p.log.success("Environment ready.");

        if (!options.yes) {
            const startSimulation = await p.confirm({
                message: "Start the self-improvement simulation?",
            });
            if (p.isCancel(startSimulation) || !startSimulation) {
                p.outro("Simulation aborted.");
                return;
            }
        }

        const simSpinner = p.spinner();
        simSpinner.start("Simulation in progress...");

        await runFullSimulation({
            config: frameworkConfig,
            initialState: buildInitialState(scenario),
            agents: activeAgents,
            judge,
            mutator,
            provisioner,
            llmClient,
            maxGenerations,
            onGenerationComplete: (gen, results) => {
                const allScores = results.flatMap(r => Object.values(r[1]));
                const avgTotal = allScores.reduce((sum, val) => sum + val, 0) / allScores.length;
                simSpinner.message(`Gen ${gen}: Global Performance Mean: ${avgTotal.toFixed(2)}`);
            },
            onPhaseChange: (phase) => p.log.info(chalk.blue(phase)),
            onTurnComplete: (speakerId, dialogue) => {
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
