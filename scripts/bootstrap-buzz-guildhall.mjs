#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const configPath = path.join(projectRoot, "config", "buzz-guildhall.json");
const config = JSON.parse(await readFile(configPath, "utf8"));

function hasFlag(name) {
  return process.argv.includes(name);
}

function option(name, fallback = "") {
  const prefix = `${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const apply = hasFlag("--apply");
const draftAgents = hasFlag("--draft-agents");
const jsonOutput = hasFlag("--json");
const cli = option("--cli", process.env.PLOTPICKLE_BUZZ_CLI || (process.platform === "win32" ? "buzz.exe" : "buzz"));

function print(message, data) {
  if (jsonOutput) return;
  process.stdout.write(`${message}${data === undefined ? "" : ` ${data}`}\n`);
}

function command(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, {
      cwd: projectRoot,
      env: process.env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) child.kill("SIGKILL");
    }, 45_000);
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.once("error", (error) => {
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Buzz CLI could not start: ${error.message}`));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString("utf8").trim();
      const err = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) reject(new Error(err || out || `Buzz CLI exited with code ${code}.`));
      else resolve(out);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input, "utf8");
  });
}

function nestedArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["channels", "items", "data", "results"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function channelRecords(value) {
  return nestedArray(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const id = String(entry.id || entry.channel_id || entry.channelId || entry.uuid || "").trim();
    const name = String(entry.name || entry.title || entry.slug || "").trim();
    return id && name ? [{ id, name }] : [];
  });
}

function parseJson(text, label) {
  try { return JSON.parse(text || "null"); }
  catch { throw new Error(`${label} returned invalid JSON.`); }
}

async function listChannels() {
  return channelRecords(parseJson(await command(["channels", "list"]), "buzz channels list"));
}

async function createChannel(definition) {
  await command([
    "channels", "create",
    "--name", definition.name,
    "--type", definition.type,
    "--visibility", definition.visibility,
    "--description", definition.description,
  ]);
}

function requireApplyCredentials() {
  if (!process.env.BUZZ_RELAY_URL?.trim()) throw new Error("--apply requires BUZZ_RELAY_URL so the bootstrap cannot accidentally target the default relay.");
  if (!process.env.BUZZ_PRIVATE_KEY?.trim()) throw new Error("--apply requires BUZZ_PRIVATE_KEY. Keep it in the process environment only; never place it in PlotPickle source or config.");
}

async function draftNativeAgent(actor, channels) {
  const room = channels.find((channel) => channel.name === config.channels.find((entry) => entry.id === actor.primaryChannel)?.name);
  if (!room) throw new Error(`Cannot draft ${actor.displayName}; primary Guildhall room is missing.`);
  await command([
    "agents", "draft-create",
    "--channel", room.id,
    "--display-name", `${actor.displayName} · ${actor.title}`,
    "--system-prompt", "-",
  ], actor.systemPrompt);
}

const plan = {
  schemaVersion: config.schemaVersion,
  guildhall: config.name,
  mode: apply ? "apply" : "dry-run",
  channels: config.channels.map((channel) => ({
    name: channel.name,
    label: channel.label,
    type: channel.type,
    visibility: channel.visibility,
  })),
  nativeAgentDrafts: config.actors
    .filter((actor) => actor.buzzPresence === "native-draft")
    .map((actor) => ({ id: actor.id, displayName: actor.displayName, title: actor.title, primaryChannel: actor.primaryChannel })),
};

if (!apply) {
  if (jsonOutput) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  else {
    print(`${config.name} bootstrap is in DRY-RUN mode.`);
    print(`Rooms planned: ${plan.channels.length}.`);
    for (const channel of plan.channels) print(`  ${channel.name}`, `(${channel.type}, ${channel.visibility})`);
    print(`Buzz-native owner-reviewed drafts: ${plan.nativeAgentDrafts.length}.`);
    for (const actor of plan.nativeAgentDrafts) print(`  ${actor.displayName}`, `— ${actor.title}`);
    print("Nothing was written. Re-run with --apply after BUZZ_RELAY_URL and BUZZ_PRIVATE_KEY are set for the intended community.");
    print("Add --draft-agents only when you want Buzz Desktop to open owner-reviewed create-agent drafts for the two native Guildhall stewards.");
  }
  process.exit(0);
}

requireApplyCredentials();
print(`Connecting ${config.name} through ${cli}.`);
let channels = await listChannels();
const created = [];
const kept = [];
for (const definition of config.channels) {
  if (channels.some((channel) => channel.name === definition.name)) {
    kept.push(definition.name);
    print("KEEP", definition.name);
    continue;
  }
  print("CREATE", definition.name);
  await createChannel(definition);
  created.push(definition.name);
}
channels = await listChannels();
const missing = config.channels.filter((definition) => !channels.some((channel) => channel.name === definition.name));
if (missing.length) throw new Error(`Buzz Guildhall bootstrap is incomplete; missing: ${missing.map((item) => item.name).join(", ")}.`);

const drafted = [];
if (draftAgents) {
  for (const actor of config.actors.filter((entry) => entry.buzzPresence === "native-draft")) {
    print("DRAFT", `${actor.displayName} · ${actor.title}`);
    await draftNativeAgent(actor, channels);
    drafted.push(actor.id);
  }
}

const result = {
  ok: true,
  guildhall: config.name,
  created,
  kept,
  readyRooms: config.channels.length,
  ownerReviewedAgentDraftsOpened: drafted,
  note: draftAgents
    ? "Buzz Desktop owns final review/save of each drafted native agent."
    : "No Buzz-native agent drafts were opened. Use --draft-agents when the owner is ready to review them in Buzz Desktop.",
};
if (jsonOutput) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
else {
  print(`Guildhall ready: ${result.readyRooms}/${config.channels.length} rooms.`);
  print(`Created ${created.length}; already present ${kept.length}.`);
  if (draftAgents) print(`Opened ${drafted.length} owner-reviewed Buzz agent draft(s).`);
  else print("Native agent drafts were intentionally skipped.");
}
