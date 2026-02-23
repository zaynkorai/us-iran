import * as p from "@clack/prompts";
import chalk from "chalk";
import ora from "ora";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

function ensureApiKeyPresent(): void {
    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        throw new Error("No LLM API key detected. Set OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY.");
    }
}

async function runChildProcess(indexPath: string): Promise<number> {
    return await new Promise((resolve, reject) => {
        const child = spawn("node", [indexPath], {
            stdio: ["inherit", "pipe", "pipe"],
            env: process.env,
        });

        const spinner = ora("Starting simulation...").start();

        child.stdout.on("data", (data) => {
            const text = data.toString().trim();
            if (text) spinner.text = text;
        });

        child.stderr.on("data", (data) => {
            console.error(chalk.red(data.toString()));
        });

        child.on("error", (err) => {
            spinner.fail(chalk.red("Failed to start simulation process."));
            reject(err);
        });

        child.on("close", (code) => {
            if (code === 0) {
                spinner.succeed(chalk.green("Simulation completed successfully."));
            } else {
                spinner.fail(chalk.red(`Simulation exited with code ${code}.`));
            }
            resolve(code ?? 1);
        });
    });
}

export async function runCommand() {
    p.intro(chalk.bgMagenta.black(" SISC - Run Simulation "));

    const cwd = process.cwd();
    const indexPath = path.join(cwd, "index.js");

    try {
        await fs.access(indexPath);
    } catch {
        p.log.error(chalk.red(`Could not find ${chalk.bold("index.js")} in ${cwd}.`));
        p.log.error(`Please run ${chalk.cyan("sisc init")} first or ensure you are in the correct directory.`);
        process.exit(1);
    }

    try {
        ensureApiKeyPresent();

        p.log.step(`Executing ${chalk.cyan("index.js")} using Node...`);
        const code = await runChildProcess(indexPath);

        if (code === 0) {
            p.outro("Self-improvement cycle finished.");
            return;
        }

        p.outro("Simulation terminated abruptly.");
        process.exit(code);
    } catch (err) {
        p.log.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
    }
}
