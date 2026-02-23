import * as p from "@clack/prompts";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { templateConfig, templateIndex, templateState } from "../templates/index.js";
import { templateAgent } from "../templates/agent.js";

async function safeWrite(filePath: string, content: string) {
    try {
        await fs.access(filePath);
        p.log.warn(`Skipped ${chalk.cyan(path.basename(filePath))} (already exists)`);
    } catch {
        await fs.writeFile(filePath, content);
    }
}

export async function initCommand(options?: { yes?: boolean }) {
    p.intro(chalk.bgCyan.black(" SISC - Initialize Project "));

    const s = p.spinner();

    const cwd = process.cwd();
    const isReady = options?.yes
        ? true
        : await p.confirm({
            message: `Initialize a new SISC project in ${cwd}?`,
            initialValue: true,
        });

    if (p.isCancel(isReady) || !isReady) {
        p.cancel("Operation cancelled.");
        process.exit(0);
    }

    s.start("Scaffolding SISC project...");

    try {
        await fs.mkdir(path.join(cwd, "agents"), { recursive: true });

        // Write templates safely
        const siscVersion = "1.0.0";

        const dynamicPackageJson = `{
  "name": "sisc-agent-project",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "sisc": "^${siscVersion}",
    "@ai-sdk/openai": "^3.0.30",
    "zod": "^4.3.6"
  }
}
`;
        await safeWrite(path.join(cwd, "package.json"), dynamicPackageJson);
        await safeWrite(path.join(cwd, "sisc.config.js"), templateConfig);
        await safeWrite(path.join(cwd, "index.js"), templateIndex);
        await safeWrite(path.join(cwd, "state.json"), templateState);
        await safeWrite(path.join(cwd, "agents", "MyActor.js"), templateAgent);

        s.stop("Project scaffolded successfully!");

        p.note(
            `1. Review ${chalk.cyan("sisc.config.js")} and ${chalk.cyan("index.js")}\n` +
            `2. Provide your API key: ${chalk.green("export OPENAI_API_KEY='sk-...'")}\n` +
            `3. Run the simulation: ${chalk.magenta("sisc run")}`,
            "Next Steps"
        );

        p.outro(chalk.green("You're ready to build self-improving agents!"));
    } catch (error: any) {
        s.stop("Failed to scaffold project.");
        p.log.error(chalk.red(error.message));
        process.exit(1);
    }
}
