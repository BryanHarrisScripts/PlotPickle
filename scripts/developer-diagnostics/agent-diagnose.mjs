#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  advanceDiagnosticLoop,
  buildDiagnosticPacket,
  createDiagnosticLoop,
  loadDiagnosticsRegistry,
  validateAgentProposal,
} from "./index.mjs";

function parseArguments(argv) {
  const options = {
    summary: "reports/developer-diagnostics/summary.json",
    plan: "reports/developer-diagnostics/changed-plan.json",
    proposal: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--summary") options.summary = argv[++index];
    else if (arg === "--plan") options.plan = argv[++index];
    else if (arg === "--proposal") options.proposal = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (fallback !== null && error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function main() {
  const root = process.cwd();
  const registry = await loadDiagnosticsRegistry(root);
  const options = parseArguments(process.argv.slice(2));
  const summary = await readJson(path.resolve(root, options.summary));
  const plan = await readJson(path.resolve(root, options.plan), {
    areas: [],
    suites: [],
    allowedPaths: [],
    command: [],
  });

  const packet = buildDiagnosticPacket(summary, plan, registry);
  let loop = createDiagnosticLoop(packet);
  loop = advanceDiagnosticLoop(loop, { type: "evidence-ready" }, packet);
  loop = advanceDiagnosticLoop(loop, { type: "classification-ready" }, packet);

  const directory = path.resolve(root, registry.reportDirectory);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "agent-packet.json"), `${JSON.stringify(packet, null, 2)}\n`, "utf8");

  if (!options.proposal) {
    await writeFile(path.join(directory, "agent-loop.json"), `${JSON.stringify(loop, null, 2)}\n`, "utf8");
    console.log("Structured diagnosis packet created. No model adapter was invoked and no repository mutation is permitted.");
    return;
  }

  const proposal = await readJson(path.resolve(root, options.proposal));
  const validation = validateAgentProposal(proposal, packet, registry, loop.audit);
  if (!validation.valid) {
    loop = advanceDiagnosticLoop(loop, { type: "ambiguous" }, packet);
    await writeFile(path.join(directory, "agent-loop.json"), `${JSON.stringify({ ...loop, proposalValidation: validation }, null, 2)}\n`, "utf8");
    throw new Error(`Agent proposal rejected:\n- ${validation.errors.join("\n- ")}`);
  }

  loop.audit.push({
    at: new Date().toISOString(),
    state: loop.state,
    event: "proposal-validated",
    fingerprint: validation.fingerprint,
    requiresHumanApproval: validation.requiresHumanApproval,
  });
  await writeFile(path.join(directory, "agent-loop.json"), `${JSON.stringify({ ...loop, proposalValidation: validation }, null, 2)}\n`, "utf8");
  console.log(validation.requiresHumanApproval
    ? "Proposal is within the diagnosed scope but requires human approval before any action."
    : "Proposal is valid for diagnosis-only review.");
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
