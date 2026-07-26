#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  formatDiagnostic,
  formatRunContract,
  selectNextTask,
  validateRepository,
} from "./core.mjs";
import { runLivePreflight } from "./live.mjs";

function usage() {
  return [
    "Usage:",
    "  node scripts/steering/cli.mjs check [--json] [--root <path>]",
    "  node scripts/steering/cli.mjs next [--json] [--live] [--root <path>]",
  ].join("\n");
}

export function parseArguments(argv) {
  const [command, ...values] = argv;
  if (!["check", "next"].includes(command)) {
    throw new Error(`Expected command "check" or "next".\n${usage()}`);
  }
  const options = {
    command,
    json: false,
    live: false,
    root: process.cwd(),
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--json") {
      options.json = true;
    } else if (value === "--live") {
      options.live = true;
    } else if (value === "--root") {
      const root = values[index + 1];
      if (!root || root.startsWith("--")) {
        throw new Error("--root requires a path.");
      }
      options.root = resolve(root);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}\n${usage()}`);
    }
  }
  if (options.command === "check" && options.live) {
    throw new Error("--live is supported only by the next command.");
  }
  return options;
}

export function runCli(argv, io = console) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    io.error(error.message);
    return 2;
  }

  const validation = validateRepository(options.root);
  if (options.command === "check") {
    if (options.json) {
      io.log(
        JSON.stringify(
          {
            schemaVersion: 1,
            valid: validation.ok,
            evidenceMode: "repository-only",
            evidenceStatement:
              "This deterministic offline check validates repository files only; it does not claim current GitHub, pull-request, protection, or workflow state.",
            taskCount: validation.tasks.length,
            readyQueue: validation.readyEvaluations.map((entry) => ({
              taskId: entry.taskId,
              eligible: entry.eligible,
              blockers: entry.blockers.map((blocker) => ({
                code: blocker.code,
                message: blocker.message,
              })),
            })),
            diagnostics: validation.diagnostics,
          },
          null,
          2,
        ),
      );
    } else if (validation.ok) {
      io.log(
        `Steering repository validation passed for ${validation.tasks.length} task packet(s).`,
      );
      io.log(
        "Evidence mode: repository-only. External GitHub state was not verified.",
      );
    } else {
      io.error(
        `Steering repository validation failed with ${validation.diagnostics.length} diagnostic(s):`,
      );
      for (const entry of validation.diagnostics) {
        io.error(formatDiagnostic(entry));
      }
    }
    return validation.ok ? 0 : 1;
  }

  let liveEvidence = null;
  if (options.live && validation.ok) {
    liveEvidence = runLivePreflight({ root: options.root });
  }
  const result = selectNextTask(validation, liveEvidence);
  if (options.json) {
    io.log(JSON.stringify(result, null, 2));
  } else {
    const output = formatRunContract(result);
    if (result.valid) io.log(output);
    else io.error(output);
  }
  return result.valid ? 0 : 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const exitCode = runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
