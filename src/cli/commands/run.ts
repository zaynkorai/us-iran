import * as p from "@clack/prompts";
import chalk from "chalk";
import ora from "ora";
import fs from "fs/promises";
import path from "path";

// Execute index.js as a child process, so it runs within the environment created by init
import { spawn } from "child_process";

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

    if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        p.log.error(chalk.red("No LLM API key detected."));
        p.log.error("Simulation requires an LLM to run. Please set OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY.");
        process.exit(1);
    }

    p.log.step(`Executing ${chalk.cyan("index.js")} using Node...`);

    const spinner = ora("Starting simulation...").start();

    // We run it via node so the user's index.js is executed naturally.
    const child = spawn("node", [indexPath], {
        stdio: ["inherit", "pipe", "pipe"],
        env: process.env,
    });

    child.stdout.on("data", (data) => {
        const text = data.toString().trim();
        if (text) {
            spinner.text = text;
        }
    });

    child.stderr.on("data", (data) => {
        // Keep stderr flowing for debugging but color it red
        console.error(chalk.red(data.toString()));
    });

    child.on("close", (code) => {
        if (code === 0) {
            spinner.succeed(chalk.green("Simulation completed successfully."));
            p.outro("Self-improvement cycle finished.");
        } else {
            spinner.fail(chalk.red(`Simulation exited with code ${code}.`));
            p.outro("Simulation terminated abruptly.");
        }
    });
}
