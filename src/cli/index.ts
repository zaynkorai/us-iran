#!/usr/bin/env node

import dotenv from "dotenv";

// Silence dotenv 17+ console output
process.env.DOTENV_CONFIG_SILENT = "true";
dotenv.config();


import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { initCommand, runCommand, simulateCommand } from "./commands/index.js";

const program = new Command();

program
    .name("sisc")
    .description("The Self-Improving Framework - CLI")
    .version("1.0.0");

program
    .command("init")
    .description("Initialize a new SISC project in the current directory")
    .option("-y, --yes", "Skip confirmation prompts")
    .action(initCommand);

program
    .command("run")
    .description("Run the SISC simulation using the local configuration")
    .action(runCommand);

program
    .command("simulate")
    .description("Run a no-code simulation from a scenario file")
    .option("-s, --scenario <path>", "Path to the scenario JSON file")
    .option("--provider <provider>", "LLM provider override (openai|google|anthropic)")
    .option("--model <model>", "LLM model override")
    .option("--max-generations <number>", "Override max generations for this run")
    .option("-y, --yes", "Skip confirmation prompt before starting the simulation")
    .action(simulateCommand);

program.parse(process.argv);
