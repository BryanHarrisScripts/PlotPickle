#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { createCreativeBrowser } from "./creative-uat/browser-actions.mjs";
import { McpClient, resultText } from "./creative-uat/mcp-runtime.mjs";
import { createPhase3b3StepDrivers, finalizePhase3b3Proof, runPhase3b3Faults } from "./creative-uat/casebook-phase3b3-live.mjs";
import { loadCasebook } from "./casebook-contract.mjs";
import { resolveLocalEndpointTarget } from "./local-endpoint-target.mjs";
import { createAttendedLiveStepDrivers, finalizeAttendedLiveProof } from "./casebook-attended-live-drivers.mjs";
import { ensureWriterAppRuntime } from "./writer-app-runtime.mjs";
import {
  assertAttendedRecordSafe,
  attendedCheckpoint,
  attendedRecordSkeleton,
  buildAttendedOverlayScript,
  buildAttendedPlaywrightServer,
  buildHumanCheckpointOverlayScript,
  scrubAttendedText,
} from "./casebook-attended-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const artifactArgIndex = argv.indexOf("--artifact-root");
const caseArgIndex = argv.indexOf("--case");
const browserArgIndex = argv.indexOf("--browser");
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const defaultArtifactRoot = path.join(localRoot, "PlotPickle", "casebook-attended");
const artifactRoot = path.resolve(artifactArgIndex >= 0 && artifactArgIndex + 1 < argv.length ? argv[artifactArgIndex + 1] : defaultArtifactRoot);
const requestedCase = caseArgIndex >= 0 && caseArgIndex + 1 < argv.length ? argv[caseArgIndex + 1] : "";
const browserName = browserArgIndex >= 0 && browserArgIndex + 1 < argv.length ? argv[browserArgIndex + 1] : "chrome";
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const pluginData = path.join(artifactRoot, "browser-profile");
const recordsDir = path.join(artifactRoot, "records");

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(42, ".")} ${state}${detail ? `  ${scrubAttendedText(detail)}` : ""}\n`);
}

async function evaluate(client, fn) {
  return resultText(await client.call("browser_evaluate", { function: fn }));
}

function pageTextScript() {
  return `() => JSON.stringify({ url: location.href, text: (document.body.innerText || '').slice(0, 18000) })`;
}

function containsAny(text, values) {
  const value = String(text || "").toLowerCase();
  return values.some((candidate) => value.includes(String(candidate).toLowerCase()));
}

async function observePage(client, expectedTokens, passSummary, failSummary) {
  const raw = await evaluate(client, pageTextScript());
  const ok = containsAny(raw, expectedTokens);
  return { outcome: ok ? "pass" : "uncertain", observed: ok ? passSummary : failSummary };
}

async function firstVisibleClick(browser, labels) {
  for (const label of labels) if (await browser.clickVisible(label)) return label;
  return "";
}

function safeStepDrivers() {
  return new Map([
    ["buzz-connect-existing-identity:open-profile-buzz", async ({ browser, client }) => {
      const clicked = await firstVisibleClick(browser, ["Profile"]);
      const observation = await observePage(client, ["BUZZ Identity"], "Profile opened and the BUZZ Identity surface is visible.", "Profile click completed but BUZZ Identity was not observed.");
      return { ...observation, interaction: "pointer", target: clicked || "Profile" };
    }],
    ["buzz-connect-existing-identity:enter-existing-key", async ({ browser, client, checkpoint }) => {
      const clicked = await firstVisibleClick(browser, ["Connect Existing Identity", "Replace identity"]);
      if (!clicked) return { outcome: "uncertain", observed: "Connect Existing Identity control was not found.", interaction: "pointer", target: "Connect Existing Identity", critical: false };
      const fieldReady = await observePage(client, ["Private identity key"], "The masked BUZZ private identity field is ready for Human entry.", "The BUZZ private identity field did not become visible.");
      return {
        outcome: "uncertain",
        observed: fieldReady.outcome === "pass"
          ? "The masked BUZZ private identity field is ready. Secret entry is Human-only and does not become PASS until the subsequent signer/connected-state verifier succeeds."
          : fieldReady.observed,
        interaction: "focus",
        target: "Private identity key",
        humanCheckpoint: checkpoint,
        critical: false,
      };
    }],
    ["buzz-connect-existing-identity:verify-signer", async ({ browser, client }) => {
      const clicked = await firstVisibleClick(browser, ["Connect identity"]);
      if (!clicked) return { outcome: "uncertain", observed: "Connect identity control was not available after Human key entry.", interaction: "pointer", target: "Connect identity" };
      await new Promise((resolve) => setTimeout(resolve, 900));
      const observation = await observePage(client, ["Connected", "verification pending", "identity verified"], "PlotPickle completed the BUZZ connection action and exposed a verifiable connected/pending state.", "PlotPickle did not expose a connected or verification-pending BUZZ state after Connect identity.");
      return { ...observation, interaction: "pointer", target: "Connect identity" };
    }],
    ["buzz-connect-existing-identity:persist-connected", async ({ browser, client }) => {
      const raw = await evaluate(client, `() => location.href`);
      const url = String(raw || "").replace(/^"|"$/g, "") || undefined;
      if (url) await browser.navigate(url);
      await new Promise((resolve) => setTimeout(resolve, 650));
      const clicked = await firstVisibleClick(browser, ["Profile"]);
      const observation = await observePage(client, ["Connected", "verification pending", "identity verified"], "BUZZ connected state remained visible after a full page reload.", "BUZZ connected state was not observed after reload.");
      return { ...observation, interaction: "navigate", target: clicked ? "Profile after reload" : "current page reload" };
    }],
    ["buzz-connect-existing-identity:open-community", async ({ browser, client }) => {
      const clicked = await firstVisibleClick(browser, ["Community"]);
      const observation = await observePage(client, ["Community", "Great Hall", "BUZZ"], "Community opened from the connected Human session.", "Community did not become visible after navigation.");
      return { ...observation, interaction: "pointer", target: clicked || "Community" };
    }],
    ["buzz-great-hall-signed-conversation:open-great-hall", async ({ browser, client }) => {
      await firstVisibleClick(browser, ["Community"]);
      const clicked = await firstVisibleClick(browser, ["The Great Hall", "Great Hall"]);
      const observation = await observePage(client, ["Great Hall"], "The Human-visible Great Hall is open.", "The Great Hall was not observed in the visible Community surface.");
      return { ...observation, interaction: "pointer", target: clicked || "Great Hall" };
    }],
    ["sage-local-text-usable-response:open-learn", async ({ browser, client }) => {
      const clicked = await firstVisibleClick(browser, ["Learn"]);
      const observation = await observePage(client, ["Learn", "Sage", "Creative Room"], "LEARN opened with a Human-facing learning/agent surface.", "LEARN did not expose the expected learning or Sage surface.");
      return { ...observation, interaction: "pointer", target: clicked || "Learn" };
    }],
  ]);
}

async function operatorCheckpoint(io, client, checkpoint) {
  await evaluate(client, buildHumanCheckpointOverlayScript(checkpoint));
  process.stdout.write(`\n${checkpoint.title}\n${checkpoint.instruction}\n`);
  if (checkpoint.secretEntry) process.stdout.write("Sensitive evidence capture is paused for this step.\n");
  await io.question("Press Enter here when the Human-authorized action is complete: ");
}

async function operatorCriticalDecision(io, caseDefinition, step, observation) {
  process.stdout.write(`\nCritical Casebook step did not pass.\nCase: ${scrubAttendedText(caseDefinition.title)}\nStep: ${scrubAttendedText(step.id)} · ${String(observation.outcome || "uncertain").toUpperCase()}\n`);
  process.stdout.write("Continue records this blocked case and moves to the next Business Case. Stop records this case and ends the attended run.\n");
  while (true) {
    const answer = String(await io.question("Choose [C]ontinue or [S]top: ")).trim().toLowerCase();
    if (answer === "c" || answer === "continue") return "continue";
    if (answer === "s" || answer === "stop") return "stop";
    process.stdout.write("Enter C to continue to the next Business Case or S to stop Casebook.\n");
  }
}

async function operatorGuidedStep(io, client, caseDefinition, step) {
  const checkpoint = attendedCheckpoint(caseDefinition.id, step.id) || {
    title: "Human observation required",
    instruction: `Complete this step in the visible PlotPickle window: ${step.action} Casebook will observe the result after you continue.`,
    secretEntry: false,
  };
  await operatorCheckpoint(io, client, checkpoint);
  const raw = await evaluate(client, pageTextScript());
  return {
    outcome: "uncertain",
    observed: `Human completed or inspected the step; automated outcome proof is not implemented for this transition yet. Visible state: ${scrubAttendedText(raw).slice(0, 420)}`,
    interaction: checkpoint.secretEntry ? "focus" : "observe",
    target: step.action,
    critical: !checkpoint.secretEntry,
  };
}

async function screenshot(browser, caseIndex, stepIndex, phase) {
  const name = `${String(caseIndex).padStart(2, "0")}-${String(stepIndex).padStart(2, "0")}-${phase}`;
  await browser.screenshot(name);
  return `creative-writer/${name}.png`;
}

function safeFailureObservation(step, error) {
  const message = scrubAttendedText(error instanceof Error ? error.message : String(error));
  return {
    outcome: "fail",
    workerClaim: "fail",
    observed: `Casebook caught a bounded runner error instead of aborting the attended run: ${message || "unknown step failure"}`,
    interaction: "observe",
    target: step.action,
    critical: true,
  };
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Attended Casebook requires an interactive terminal because Human authorization checkpoints must never be automated or supplied through logs.");
  await mkdir(pluginData, { recursive: true });
  await mkdir(recordsDir, { recursive: true });
  const endpointTarget = await resolveLocalEndpointTarget({ args: argv });
  const casebook = await loadCasebook();
  const cases = casebook.cases.filter((item) => item.priority === "P0" && (!requestedCase || item.id === requestedCase));
  if (!cases.length) throw new Error(`No P0 Business Case matched --case ${requestedCase || "<all>"}.`);

  const config = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const visibleServer = buildAttendedPlaywrightServer(config?.mcpServers?.playwright, { pluginRoot, pluginData, browser: browserName });
  const client = new McpClient(visibleServer.command, visibleServer.args, { cwd: visibleServer.cwd, env: visibleServer.env });
  const io = createInterface({ input: process.stdin, output: process.stdout });
  const runnerFindings = [];
  const browserEvidence = [];
  let tools = [];

  status("Attended endpoint", "CHECKING", endpointTarget.baseUrl);
  status("Browser mode", "VISIBLE", `${browserName}; Human checkpoints enabled`);
  status("Secret policy", "ACTIVE", "credentials stay in PlotPickle/native prompts; never terminal input or Casebook records");

  const appRuntime = await ensureWriterAppRuntime({
    baseUrl: endpointTarget.baseUrl,
    repoRoot,
    onStatus: (state, detail) => status("PlotPickle", String(state || "").toUpperCase(), detail),
  });
  await endpointTarget.assertCurrent();
  status("Attended endpoint", "READY", `${endpointTarget.baseUrl}; ${appRuntime.source}`);

  try {
    await client.initialize();
    tools = await client.tools();
    const browser = createCreativeBrowser(client, tools, { baseUrl: endpointTarget.baseUrl, runnerFindings, evidence: browserEvidence });
    await browser.navigate(endpointTarget.baseUrl);
    let recordedCaseCount = 0;
    let operatorStopped = false;

    for (let caseOffset = 0; caseOffset < cases.length; caseOffset += 1) {
      const caseDefinition = cases[caseOffset];
      const record = attendedRecordSkeleton(caseDefinition);
      const runState = {};
      const drivers = new Map([
        ...safeStepDrivers(),
        ...createAttendedLiveStepDrivers({ browser, client, baseUrl: endpointTarget.baseUrl, runState }),
        ...createPhase3b3StepDrivers({ browser, client, runState }),
      ]);
      let caseInterrupted = false;
      let caseDecision = "";
      let interruptedStepId = "";
      status(caseDefinition.title, "START", `${caseOffset + 1}/${cases.length}`);

      for (let stepOffset = 0; stepOffset < caseDefinition.humanJourney.length; stepOffset += 1) {
        const step = caseDefinition.humanJourney[stepOffset];
        const checkpoint = attendedCheckpoint(caseDefinition.id, step.id);
        let beforeScreenshot = "";
        let afterScreenshot = "";
        let observation;

        try {
          await evaluate(client, buildAttendedOverlayScript({
            caseIndex: caseOffset + 1,
            caseCount: cases.length,
            caseTitle: caseDefinition.title,
            stepIndex: stepOffset + 1,
            stepCount: caseDefinition.humanJourney.length,
            stepAction: step.action,
            state: checkpoint ? "human-action" : "working",
            detail: checkpoint ? "Casebook will pause before sensitive/native authority." : "Casebook is operating the visible app.",
          }));

          if (!checkpoint?.secretEntry) beforeScreenshot = await screenshot(browser, caseOffset + 1, stepOffset + 1, "before");
          const driver = drivers.get(`${caseDefinition.id}:${step.id}`);
          observation = driver
            ? await driver({ browser, client, checkpoint })
            : await operatorGuidedStep(io, client, caseDefinition, step);
          if (observation.humanCheckpoint) {
            const afterHuman = observation.afterHuman;
            await operatorCheckpoint(io, client, observation.humanCheckpoint);
            observation = typeof afterHuman === "function"
              ? await afterHuman()
              : { ...observation, humanCheckpoint: undefined, afterHuman: undefined };
          }
          if (!checkpoint?.secretEntry && observation.critical !== false) afterScreenshot = await screenshot(browser, caseOffset + 1, stepOffset + 1, "after");
        } catch (error) {
          observation = safeFailureObservation(step, error);
          runnerFindings.push(`${caseDefinition.id}:${step.id} bounded failure: ${observation.observed}`);
        }

        record.steps.push({
          stepId: step.id,
          outcome: observation.outcome,
          workerClaim: observation.outcome,
          observed: scrubAttendedText(observation.observed),
          interaction: observation.interaction || "observe",
          target: scrubAttendedText(observation.target || step.action),
          critical: observation.critical !== false,
          beforeScreenshot,
          afterScreenshot,
          evidence: Array.isArray(observation.evidence) ? observation.evidence : [],
        });
        status(`  ${step.id}`, observation.outcome.toUpperCase(), observation.observed);

        if (observation.critical !== false && observation.outcome !== "pass") {
          caseInterrupted = true;
          interruptedStepId = step.id;
          record.criticalInteractionsUnreached = Math.max(0, caseDefinition.humanJourney.length - stepOffset - 1);
          record.blockers.push(`Critical journey step ${step.id} ended ${String(observation.outcome).toUpperCase()}; ${record.criticalInteractionsUnreached} remaining dependent journey step(s) were not exercised.`);
          caseDecision = await operatorCriticalDecision(io, caseDefinition, step, observation);
          break;
        }
      }

      let detectedFaults = 0;
      if (caseInterrupted) {
        record.blockers.push("Independent Business Case outcome proof was not run after the Human-controlled critical interruption.");
        record.blockers.push("Deliberate fault checks were not run because the journey stopped at a critical non-pass.");
        record.faults = [];
      } else {
        try {
          const phase3b3Proof = await finalizePhase3b3Proof({ caseDefinition, runState });
          const existingProof = phase3b3Proof || await finalizeAttendedLiveProof({ caseDefinition, client, baseUrl: endpointTarget.baseUrl, runState });
          if (existingProof) record.independentVerification = existingProof;
        } catch (error) {
          const message = scrubAttendedText(error instanceof Error ? error.message : String(error));
          record.blockers.push(`Independent Business Case proof raised a bounded runner error: ${message}`);
          runnerFindings.push(`${caseDefinition.id} proof failure: ${message}`);
        }
        if (record.independentVerification.status !== "verified") {
          record.blockers.push("Independent Business Case outcome proof is still missing or contradicted.");
        }

        try {
          record.faults = await runPhase3b3Faults({ caseDefinition, client, runState });
        } catch (error) {
          const message = scrubAttendedText(error instanceof Error ? error.message : String(error));
          record.blockers.push(`Deliberate fault verification raised a bounded runner error: ${message}`);
          runnerFindings.push(`${caseDefinition.id} fault failure: ${message}`);
          record.faults = [];
        }
        detectedFaults = record.faults.filter((item) => item.injected === true && item.detected === true).length;
        if (!record.faults.length || detectedFaults !== record.faults.length) {
          record.blockers.push("One or more required deliberate fault checks are missing or were not detected.");
        }
      }

      if (record.steps.some((item) => item.critical !== false && item.outcome !== "pass")) {
        record.blockers.push("One or more critical Human/Business Case journey steps did not pass.");
      }

      assertAttendedRecordSafe(record);
      await writeFile(path.join(recordsDir, `${caseDefinition.id}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
      recordedCaseCount += 1;
      status(caseDefinition.title, "RECORDED", `independent=${record.independentVerification.status}; faults=${detectedFaults}/${record.faults.length}; blockers=${record.blockers.length}`);

      if (caseDecision === "stop") {
        operatorStopped = true;
        status("Attended Casebook", "STOPPED", `${caseDefinition.title} · ${interruptedStepId}`);
        break;
      }
    }

    await endpointTarget.assertCurrent();
    process.stdout.write(`\nAttended run recorded ${recordedCaseCount} Business Case${recordedCaseCount === 1 ? "" : "s"}.\n`);
    if (operatorStopped) {
      process.stdout.write("Casebook stopped by Human choice after a critical non-pass. The interrupted case was recorded safely; rerun when you are ready to continue testing.\n");
    } else {
      process.stdout.write("Casebook now combines visible Human journeys, independent outcome proof and deliberate fault checks. A case remains non-green if any critical step, independent proof or fault detector is missing.\n");
    }
  } finally {
    io.close();
    if (tools.some((tool) => tool.name === "browser_close")) {
      try {
        await client.call("browser_close", {});
      } catch (error) {
        runnerFindings.push(`Browser close warning: ${scrubAttendedText(error instanceof Error ? error.message : String(error))}`);
      }
    }
    await client.close().catch((error) => runnerFindings.push(`MCP close warning: ${scrubAttendedText(error instanceof Error ? error.message : String(error))}`));
    await appRuntime.stop().catch((error) => runnerFindings.push(`PlotPickle close warning: ${scrubAttendedText(error instanceof Error ? error.message : String(error))}`));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});