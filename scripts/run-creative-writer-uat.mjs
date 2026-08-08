#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createCreativeBrowser } from "./creative-uat/browser-actions.mjs";
import { creativeWriterFixture } from "./creative-uat/fixture.mjs";
import { delay, McpClient, slug } from "./creative-uat/mcp-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
};

const baseUrl = argument("--base-url", process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173");
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(argument("--artifact-root", path.join(localRoot, "PlotPickle", "uat")));
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const pluginData = path.join(artifactRoot, "agent-plugin");
const reportPath = path.join(artifactRoot, "acceptance-report.md");
const tracePath = path.join(artifactRoot, "creative-writer-trace.jsonl");
const mcpLogPath = path.join(artifactRoot, "creative-writer-playwright-mcp.log");
const fixture = creativeWriterFixture();

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(pluginData, { recursive: true });
  await mkdir(path.join(artifactRoot, "creative-writer"), { recursive: true });

  const config = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const server = config?.mcpServers?.playwright;
  if (!server || server.type !== "stdio") throw new Error("Creative Writer UAT requires the Playwright MCP server from the Agent Plugin.");
  const expand = (value) => String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
  const client = new McpClient(expand(server.command), (server.args || []).map(expand), {
    cwd: expand(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value)])),
  });

  const evidence = [];
  const runnerFindings = [];
  let deterministicError = null;
  let tools = [];

  try {
    await client.initialize();
    tools = await client.tools();
    const browser = createCreativeBrowser(client, tools, { baseUrl, runnerFindings, evidence });
    const { clickVisible, currentState, fillByLabel, fillDraft, gotoStorySection, gotoWorkspace, navigate, record, screenshot, snapshot } = browser;

    await navigate(baseUrl);
    await delay(400);
    await screenshot("00-splash");
    if (!await clickVisible("Enter")) {
      await navigate(new URL("/?workspace=dashboard", baseUrl).toString());
      await delay(450);
      runnerFindings.push("Splash Enter was unavailable; Dashboard deep-link recovery was used.");
    }
    let state = await currentState();
    await record(1, "Dashboard", state.activeId === "dashboard" ? "PASS" : "FAIL", "Enter PlotPickle as a first-time visual writer.");

    const newProjectClicked = await clickVisible("New Project");
    await delay(450);
    state = await currentState();
    const newProjectReady = newProjectClicked && state.activeId === "planner" && /Story Setup/i.test(state.bodyText || "");
    await record(2, "New Project", newProjectReady ? "PASS" : "FAIL", newProjectReady ? "A blank editable story opened in Story Setup." : "New Project did not produce the expected blank Story Setup workflow.");

    let ok = true;
    for (const [label, value] of [["Title", fixture.title], ["Primary audience", fixture.audience], ["Format", "Feature screenplay"], ["Language", "English"]]) {
      ok = (await fillByLabel(label, value)).ok && ok;
    }
    await delay(500);
    state = await currentState();
    ok = ok && state.title === fixture.title;
    await record(3, "Story Setup", ok ? "PASS" : "FAIL", ok ? "Project identity and audience container were entered through the visible planning surface." : "Story Setup fields did not persist into project state.");

    ok = await gotoStorySection("Concept Canvas");
    for (const [label, value] of [
      ["Concept seed", fixture.conceptSeed], ["Emotional purpose", fixture.emotionalPurpose], ["Audience experience", fixture.audienceExperience],
      ["Desired visual impact", fixture.visualImpact], ["Must-keep constraints", fixture.constraints], ["Open exploration", fixture.exploration],
    ]) ok = (await fillByLabel(label, value)).ok && ok;
    await record(4, "Concept Canvas", ok ? "PASS" : "FAIL", ok ? "Concept, feeling, visual intention, constraints and exploration were recorded before any provider choice." : "The creative seed could not be completed.");

    ok = await gotoStorySection("World");
    for (const [label, value] of [["Ordinary world", fixture.ordinaryWorld], ["New world", fixture.newWorld], ["Visual language", fixture.visualLanguage]]) ok = (await fillByLabel(label, value)).ok && ok;
    let created = await clickVisible("Create the first location");
    if (!created) created = await clickVisible("Add location");
    if (created) {
      ok = (await fillByLabel("Location name", fixture.locationName)).ok && ok;
      ok = (await fillByLabel("Description", fixture.locationDescription)).ok && ok;
    } else ok = false;
    state = await currentState();
    ok = ok && state.locationCount >= 1;
    await record(5, "World and Location", ok ? "PASS" : "FAIL", ok ? "A reusable location and visual language were created as story material." : "The visual world could not be established before Storyboard.");

    ok = await gotoStorySection("Characters");
    created = await clickVisible("Create the protagonist");
    if (!created) created = await clickVisible("Add character");
    if (created) {
      for (const [label, value] of [["Name", fixture.characterName], ["Story role", fixture.characterRole], ["Character description", fixture.characterDescription], ["Conscious want", fixture.want], ["Unconscious need", fixture.need]]) ok = (await fillByLabel(label, value)).ok && ok;
    } else ok = false;
    state = await currentState();
    ok = ok && state.characterCount >= 1;
    await record(6, "Character Identity", ok ? "PASS" : "FAIL", ok ? "The protagonist was created as visual and narrative identity before downstream scene work." : "The protagonist could not be created through the visible Character workflow.");

    ok = await gotoStorySection("24 Blocks");
    for (const [label, value] of [
      ["Block title", fixture.blockTitle], ["Story section", fixture.blockSection], ["Goal", fixture.goal], ["Conflict", fixture.conflict], ["Choice", fixture.choice],
      ["Action", fixture.action], ["Consequence", fixture.consequence], ["Story text", fixture.storyText], ["Storyboard direction", fixture.storyboardDirection],
    ]) ok = (await fillByLabel(label, value)).ok && ok;
    await clickVisible(fixture.characterName);
    await clickVisible(fixture.locationName);
    state = await currentState();
    ok = ok && state.blockTitle === fixture.blockTitle && Boolean(state.blockSummary);
    await record(7, "Story Moment", ok ? "PASS" : "FAIL", ok ? "Act 1 · Block 1 became a visual story moment with character and location context." : "The canonical story moment could not be established.");

    await navigate(new URL("/?workspace=plan", baseUrl).toString());
    await delay(650);
    state = await currentState();
    ok = state.title === fixture.title && state.characterCount >= 1 && state.locationCount >= 1 && state.blockTitle === fixture.blockTitle;
    await record(8, "Persistence Check", ok ? "PASS" : "FAIL", ok ? "Project, character, location and Block 1 survived a full browser reload." : "Creative project data did not survive reload consistently.");

    let nav = await gotoWorkspace("Storyboard", "visuals", "storyboard");
    let snap = await snapshot();
    let status = nav.ok ? (nav.method === "direct recovery navigation" ? "WARN" : "PASS") : "FAIL";
    let note = nav.method === "direct recovery navigation" ? "Visible Storyboard navigation needed recovery. " : "";
    const decisions = /Decide what happens to this visual|\bKeep\b/i.test(snap) && /\bChange\b/i.test(snap) && /\bCompare\b/i.test(snap);
    if (nav.ok && !decisions) { status = "WARN"; note += "Keep / Change / Compare was not discoverable for this blank-project story moment."; }
    else if (nav.ok) { await clickVisible("Change"); await clickVisible("Compare"); note += "Creative-direction controls were available without provider selection."; }
    await record(9, "Storyboard Direction", status, note);

    nav = await gotoWorkspace("Write", "script", "write");
    status = nav.ok ? (nav.method === "direct recovery navigation" ? "WARN" : "PASS") : "FAIL";
    note = nav.method === "direct recovery navigation" ? "Visible Write navigation needed recovery. " : "";
    if (nav.ok) {
      await clickVisible("Screenplay");
      await clickVisible("Write the first scene");
      const heading = await fillDraft(fixture.sceneHeading);
      await clickVisible("Action");
      const action = await fillDraft(fixture.sceneAction);
      state = await currentState();
      if (!heading || !action || state.screenplayCount < 2) { status = "FAIL"; note += "Representative screenplay material could not be created."; }
      else note += "Scene heading and action were added to the same project.";
    }
    await record(10, "Write Screenplay", status, note);

    nav = await gotoWorkspace("Edit", "edit", "edit", "/edit");
    status = nav.ok ? (nav.method === "direct recovery navigation" ? "WARN" : "PASS") : "FAIL";
    note = nav.method === "direct recovery navigation" ? "Visible Edit navigation needed recovery. " : "";
    if (nav.ok) {
      snap = await snapshot();
      const revisionChoices = ["Rewrite myself", "Ignore", "Compare"].filter((label) => snap.includes(label));
      if (!revisionChoices.length) { status = "WARN"; note += "No candidate revision controls were available without first creating a suggestion; canon remained unchanged."; }
      else note += `Revision choices visible: ${revisionChoices.join(", ")}.`;
    }
    await record(11, "Edit and Revision", status, note);

    nav = await gotoWorkspace("Graphic Novel", "pitch", "pitch");
    status = nav.ok ? (nav.method === "direct recovery navigation" ? "WARN" : "PASS") : "FAIL";
    note = nav.method === "direct recovery navigation" ? "Visible Graphic Novel navigation needed recovery. " : "";
    if (nav.ok) {
      snap = await snapshot();
      if (snap.includes("Change")) await clickVisible("Change");
      if (snap.includes("Compare")) await clickVisible("Compare");
      if (!snap.includes("Approve")) { status = "WARN"; note += "No local visual candidate existed to approve without generation; no paid or provider-dependent request was triggered."; }
      else note += "Candidate review and explicit approval controls were available; no silent canon promotion was observed.";
    }
    await record(12, "Graphic Novel", status, note);

    nav = await gotoWorkspace("Build", "build", "build");
    await record(13, "Build", nav.ok ? (nav.method === "direct recovery navigation" ? "WARN" : "PASS") : "FAIL", nav.ok ? "Story context remained available for downstream assembly." : "Build could not be reached with the current story context.");

    nav = await gotoWorkspace("Feedback", "feedback", "feedback");
    status = nav.ok ? (nav.method === "direct recovery navigation" ? "WARN" : "PASS") : "FAIL";
    note = nav.method === "direct recovery navigation" ? "Visible Feedback navigation needed recovery. " : "";
    if (nav.ok) {
      const opened = await clickVisible("Add feedback");
      const title = opened && (await fillByLabel("Title", fixture.feedbackTitle)).ok;
      const body = opened && (await fillByLabel("Feedback", fixture.feedbackBody)).ok;
      const proposal = opened && (await fillByLabel("Proposed change", fixture.proposedChange)).ok;
      const saved = opened && await clickVisible("Create anchored feedback");
      if (!title || !body || !proposal || !saved) { status = "FAIL"; note += "Anchored feedback could not be created."; }
      else { await clickVisible("Considered"); note += "Anchored feedback was created and classified without mutating source material."; }
    }
    await record(14, "Feedback", status, note);

    let refineStatus = "FAIL";
    let refineNote = "Feedback could not continue into Refine.";
    if (status !== "FAIL") {
      const continued = await clickVisible("Continue to Refine");
      await delay(550);
      state = await currentState();
      if (continued && state.activeId === "engines") { refineStatus = "PASS"; refineNote = "The anchored feedback path continued into Refine."; }
      else {
        nav = await gotoWorkspace("Refine", "engines", "refine");
        if (nav.ok) { refineStatus = "WARN"; refineNote = "Continue to Refine needed local recovery navigation."; }
      }
    }
    await record(15, "Refine", refineStatus, refineNote);

    nav = await gotoWorkspace("Graphic Novel", "pitch", "pitch");
    state = await currentState();
    ok = nav.ok && state.title === fixture.title && state.characterCount >= 1 && state.locationCount >= 1 && state.screenplayCount >= 2;
    await record(16, "Return to Graphic Novel", ok ? (nav.method === "direct recovery navigation" ? "WARN" : "PASS") : "FAIL", ok ? "The story returned to Graphic Novel with project, character/world and screenplay continuity after Feedback and Refine." : "The creative loop returned with missing or inconsistent project context.");
  } catch (error) {
    deterministicError = error instanceof Error ? error : new Error(String(error));
  } finally {
    try { if (tools.some((tool) => tool.name === "browser_close")) await client.call("browser_close", {}); } catch {}
    await client.close();
    await writeFile(tracePath, client.trace.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
    await writeFile(mcpLogPath, client.stderr || "", "utf8");
  }

  const failures = evidence.filter((item) => item.status === "FAIL");
  const warnings = evidence.filter((item) => item.status === "WARN");
  const overall = deterministicError || failures.length ? "FAIL" : warnings.length ? "WARN" : "PASS";
  const lines = [
    "# PlotPickle Creative Writer Acceptance Test", "", `Overall: ${overall}`, "Scope: creative", `Target: ${baseUrl}`,
    `Disposable project: ${fixture.title}`, "Persona: first-time visual creative writer/director", "Cloud AI required: no", "Codex required: no", "",
    "## Creative journey", "", "| Stage | Result | Project / story evidence | Screenshot |", "| --- | --- | --- | --- |",
  ];
  for (const item of evidence) {
    const state = item.state || {};
    const context = [state.title, state.activeId, state.blockTitle, `characters ${state.characterCount ?? 0}`, `locations ${state.locationCount ?? 0}`, `script ${state.screenplayCount ?? 0}`].filter(Boolean).join(" · ");
    lines.push(`| ${item.label} | ${item.status} | ${String(context).replaceAll("|", "\\|")} | creative-writer/${String(item.stage).padStart(2, "0")}-${slug(item.label)}.png |`);
  }
  lines.push("", "## Product Flow findings", "");
  const productFindings = evidence.filter((item) => item.status !== "PASS" || item.note);
  if (!productFindings.length) lines.push("- PASS: The complete visual-writing loop was understandable and completed without recovery.");
  else for (const item of productFindings) lines.push(`- ${item.status} ${item.label}: ${item.note || "No additional note."}`);
  lines.push("", "## Runner / Infrastructure findings", "");
  if (deterministicError) lines.push(`- FAIL: ${deterministicError.message}`);
  for (const finding of [...new Set(runnerFindings)]) lines.push(`- INFO: ${finding}`);
  if (!deterministicError && !runnerFindings.length) lines.push("- PASS: Playwright MCP supported all required visible actions and evidence capture directly.");
  lines.push(
    "", "## Creative-direction contract", "",
    "The run follows Concept -> Explore -> Compare -> Direct -> Refine -> Approve -> Reuse where the current local product exposes those decisions. Missing candidate-generation material is reported as a product WARN rather than silently invoking an AI provider or paid request.", "",
    "Character identity and Location/World direction are treated as writing, not Settings. Provider/model/billing configuration is never required to complete the deterministic baseline.", "",
    "## Safety boundary", "",
    "This Creative Writer UAT runs in Playwright MCP's isolated local browser context against 127.0.0.1 only. It creates a disposable browser-local project, performs no external writes, uses no real credentials, triggers no paid generation, and never edits repository files. Existing user projects outside the isolated UAT browser context are not modified.", "",
  );
  await writeFile(reportPath, lines.join("\n"), "utf8");
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exitCode = overall === "FAIL" ? 1 : 0;
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(reportPath, `# PlotPickle Creative Writer Acceptance Test\n\nOverall: FAIL\n\n${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
