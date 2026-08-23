#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const ALLOWED_ROLES = new Set(["owner", "admin", "member", "guest", "bot"]);

export const ARCHIVE_CONFIRMATION = "ARCHIVE 9 LEGACY ROOMS";
export const retainedRoomIds = Object.freeze(["great-hall", "story-council", "wyrmwood-ring", "marquee"]);
export const retiredRoomIds = Object.freeze([
  "forge",
  "gatehouse",
  "github-herald",
  "lantern-watch",
  "wayfarer-journal",
  "lore-library",
  "thread-vault",
  "critics-circle",
  "archive",
]);

function option(name, fallback = "") {
  const prefix = `${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function parseJson(value, label) {
  try { return JSON.parse(value || "null"); }
  catch { throw new Error(`${label} returned invalid JSON.`); }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["channels", "messages", "items", "data", "results"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function channelId(value) {
  return clean(value?.channel_id ?? value?.channelId ?? value?.id);
}

function isArchived(value) {
  return value?.archived === true || clean(value?.archived).toLowerCase() === "true";
}

export function resetConfirmation(roomId) {
  return `RESET ${roomId}`;
}

export function validateCleanupConfiguration(guildhall, cleanup) {
  if (cleanup?.schemaVersion !== 1) throw new Error("Unsupported BUZZ cleanup configuration.");
  const configured = new Set(guildhall?.channels?.map((room) => room.id) ?? []);
  if (JSON.stringify(cleanup.retainedRooms?.map((room) => room.id)) !== JSON.stringify(retainedRoomIds)) {
    throw new Error("BUZZ cleanup retained rooms do not match the provisioning contract.");
  }
  if (JSON.stringify(cleanup.retiredRooms?.map((room) => room.id)) !== JSON.stringify(retiredRoomIds)) {
    throw new Error("BUZZ cleanup retired rooms do not match the nine-room retirement contract.");
  }
  const known = configured;
  for (const actor of guildhall.actors ?? []) {
    if (!known.has(actor.primaryChannel)) throw new Error(`${actor.id} still targets retired room ${actor.primaryChannel}.`);
  }
  for (const [eventType, roomId] of Object.entries(guildhall.eventRoutes ?? {})) {
    if (!known.has(roomId)) throw new Error(`${eventType} still routes to retired room ${roomId}.`);
  }
}

function commandRunner(cli) {
  return (args) => new Promise((resolve, reject) => {
    const child = spawn(cli, args, {
      cwd: root,
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let bytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("BUZZ CLI timed out."));
    }, 45_000);
    const collect = (target, chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES && !settled) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("BUZZ CLI returned too much output."));
        return;
      }
      target.push(Buffer.from(chunk));
    };
    child.stdout.on("data", (chunk) => collect(stdout, chunk));
    child.stderr.on("data", (chunk) => collect(stderr, chunk));
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`BUZZ CLI could not start: ${error.message}`));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString("utf8").trim();
      const err = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) reject(new Error(err || out || `BUZZ CLI exited with code ${code}.`));
      else resolve(out);
    });
  });
}

async function runJson(run, args, label) {
  return parseJson(await run(["--format", "json", ...args]), label);
}

async function exactRooms(run, roomName) {
  return asArray(await runJson(run, ["channels", "search", "--query", roomName, "--exact", "--include-archived"], `buzz channels search (${roomName})`));
}

async function liveRoomInventory(run, definition, action) {
  const matches = await exactRooms(run, definition.name);
  const active = matches.filter((room) => !isArchived(room));
  const archived = matches.filter(isArchived);
  const result = {
    id: definition.id,
    name: definition.name,
    action,
    status: active.length > 1 ? "duplicate-active" : active.length === 1 ? "active" : archived.length ? "archived" : "missing",
    activeChannelIds: active.map(channelId),
    archivedChannelIds: archived.map(channelId),
    recentMessageWindow: null,
    memberCount: null,
  };
  if (active.length === 1) {
    const id = channelId(active[0]);
    const [messages, members] = await Promise.all([
      runJson(run, ["messages", "get", "--channel", id, "--limit", "100"], `buzz messages get (${definition.name})`),
      runJson(run, ["channels", "members", "--channel", id], `buzz channels members (${definition.name})`),
    ]);
    result.recentMessageWindow = asArray(messages).length;
    result.memberCount = asArray(members).length;
  }
  return result;
}

async function archiveLegacyRooms(run, cleanup, confirmation) {
  if (confirmation !== ARCHIVE_CONFIRMATION) throw new Error(`Archive mode requires exact confirmation: ${ARCHIVE_CONFIRMATION}`);
  const changes = [];
  for (const definition of cleanup.retiredRooms) {
    const matches = await exactRooms(run, definition.id);
    const active = matches.filter((room) => !isArchived(room));
    if (active.length > 1) throw new Error(`${definition.id} has ${active.length} active matches; resolve duplicates in BUZZ Desktop first.`);
    if (!active.length) {
      changes.push({ room: definition.id, status: matches.some(isArchived) ? "already-archived" : "missing" });
      continue;
    }
    const id = channelId(active[0]);
    const response = await runJson(run, ["channels", "archive", "--channel", id], `buzz channels archive (${definition.id})`);
    if (response?.accepted === false) throw new Error(`BUZZ rejected the archive request for ${definition.id}.`);
    const verified = (await exactRooms(run, definition.id)).find((room) => channelId(room) === id);
    if (!verified || !isArchived(verified)) throw new Error(`BUZZ did not verify ${definition.id} as archived.`);
    changes.push({ room: definition.id, channelId: id, status: "archived" });
  }
  return changes;
}

async function resetRetainedRoom(run, cleanup, roomId, confirmation) {
  if (!retainedRoomIds.includes(roomId)) throw new Error(`Reset is limited to retained rooms: ${retainedRoomIds.join(", ")}.`);
  if (confirmation !== resetConfirmation(roomId)) throw new Error(`Reset mode requires exact confirmation: ${resetConfirmation(roomId)}`);
  const definition = cleanup.retainedRooms.find((room) => room.id === roomId);
  const matches = await exactRooms(run, definition.name);
  const active = matches.filter((room) => !isArchived(room));
  if (active.length !== 1) throw new Error(`Reset requires exactly one active ${definition.name} room; found ${active.length}.`);
  const oldChannelId = channelId(active[0]);
  const members = asArray(await runJson(run, ["channels", "members", "--channel", oldChannelId], `buzz channels members (${definition.name})`));

  const deletion = await runJson(run, ["channels", "delete", "--channel", oldChannelId], `buzz channels delete (${definition.name})`);
  if (deletion?.accepted === false) throw new Error(`BUZZ rejected the reset deletion for ${definition.name}.`);
  const afterDelete = await exactRooms(run, definition.name);
  if (afterDelete.some((room) => channelId(room) === oldChannelId && !isArchived(room))) {
    throw new Error(`BUZZ still reports the old ${definition.name} room as active; no replacement was created.`);
  }

  const creation = await runJson(run, [
    "channels", "create",
    "--name", definition.name,
    "--type", definition.type,
    "--visibility", definition.visibility,
    "--description", definition.description,
  ], `buzz channels create (${definition.name})`);
  const newChannelId = channelId(creation);
  if (!newChannelId) throw new Error(`BUZZ did not return a new channel id for ${definition.name}.`);

  const initialMembers = asArray(await runJson(run, ["channels", "members", "--channel", newChannelId], `buzz channels members (${definition.name} replacement)`));
  const existing = new Set(initialMembers.map((member) => clean(member.pubkey).toLowerCase()).filter(Boolean));
  let restoredMembers = 0;
  for (const member of members) {
    const pubkey = clean(member.pubkey).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(pubkey) || existing.has(pubkey)) continue;
    const role = ALLOWED_ROLES.has(clean(member.role)) ? clean(member.role) : "member";
    const response = await runJson(run, ["channels", "add-member", "--channel", newChannelId, "--pubkey", pubkey, "--role", role], `buzz channels add-member (${definition.name})`);
    if (response?.accepted === false) throw new Error(`BUZZ rejected member restoration in ${definition.name}.`);
    restoredMembers += 1;
  }

  const verified = (await exactRooms(run, definition.name)).filter((room) => !isArchived(room));
  if (verified.length !== 1 || channelId(verified[0]) !== newChannelId) throw new Error(`BUZZ did not verify the replacement ${definition.name} room.`);
  const messages = asArray(await runJson(run, ["messages", "get", "--channel", newChannelId, "--limit", "100"], `buzz messages get (${definition.name} replacement)`));
  if (messages.length) throw new Error(`The replacement ${definition.name} room is not empty.`);
  return { room: roomId, oldChannelId, newChannelId, restoredMembers, status: "reset-clean" };
}

export async function executeCleanup({ mode, roomId = "", confirmation = "", guildhall, cleanup, run }) {
  validateCleanupConfiguration(guildhall, cleanup);
  const retained = await Promise.all(cleanup.retainedRooms.map((room) => liveRoomInventory(run, room, "KEEP")));
  const retired = await Promise.all(cleanup.retiredRooms.map((room) => liveRoomInventory(run, { ...room, name: room.id }, "ARCHIVE")));
  const report = { mode, retained, retired, changes: [] };
  if (mode === "archive") report.changes = await archiveLegacyRooms(run, cleanup, confirmation);
  else if (mode === "reset") report.changes = [await resetRetainedRoom(run, cleanup, roomId, confirmation)];
  else if (mode !== "plan") throw new Error("Use --mode=plan, --mode=archive or --mode=reset.");
  return report;
}

function printReport(report) {
  process.stdout.write("\nPLOTPICKLE / BUZZ COMMUNITY CLEANUP\n\n");
  process.stdout.write("KEEP\n");
  for (const room of report.retained) process.stdout.write(`  ${room.name}: ${room.status}; recent messages ${room.recentMessageWindow ?? "n/a"}; members ${room.memberCount ?? "n/a"}\n`);
  process.stdout.write("\nARCHIVE\n");
  for (const room of report.retired) process.stdout.write(`  ${room.name}: ${room.status}; recent messages ${room.recentMessageWindow ?? "n/a"}; members ${room.memberCount ?? "n/a"}\n`);
  if (report.changes.length) {
    process.stdout.write("\nCHANGES\n");
    for (const change of report.changes) process.stdout.write(`  ${change.room}: ${change.status}\n`);
  } else {
    process.stdout.write("\nPLAN ONLY: nothing was changed.\n");
  }
}

async function main() {
  const mode = option("--mode", "plan").toLowerCase();
  const relayUrl = clean(process.env.BUZZ_RELAY_URL);
  const privateKey = clean(process.env.BUZZ_PRIVATE_KEY);
  if (!relayUrl) throw new Error("BUZZ_RELAY_URL is required.");
  if (!privateKey) throw new Error("BUZZ_PRIVATE_KEY is required and must be supplied only through the process environment.");
  const [guildhall, cleanup] = await Promise.all([
    readFile(path.join(root, "config", "buzz-guildhall.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "config", "buzz-community-cleanup.json"), "utf8").then(JSON.parse),
  ]);
  const report = await executeCleanup({
    mode,
    roomId: option("--room"),
    confirmation: option("--confirm"),
    guildhall,
    cleanup,
    run: commandRunner(option("--cli", process.env.BUZZ_CLI_PATH || (process.platform === "win32" ? "buzz.exe" : "buzz"))),
  });
  if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else printReport(report);
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
