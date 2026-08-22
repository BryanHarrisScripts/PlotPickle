#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const statePath = path.join(root, ".plotpickle", "operator", "community-agent-provisioning.json");
const pluginPath = process.env.PLOTPICKLE_COMMUNITY_PLUGIN_CONFIG
  ? path.resolve(process.env.PLOTPICKLE_COMMUNITY_PLUGIN_CONFIG)
  : path.join(root, "plugins", "plotpickle-playhouse", "community.json");
const buzz = process.env.BUZZ_CLI_PATH?.trim() || "buzz";
const relayUrl = process.env.BUZZ_RELAY_URL?.trim() || "";
const humanKey = process.env.BUZZ_PRIVATE_KEY?.trim() || "";
const provisionerKey = process.env.PLOTPICKLE_BUZZ_PROVISIONER_PRIVATE_KEY?.trim() || "";
const provisionerAuthTag = process.env.BUZZ_AUTH_TAG?.trim() || "";
const MAX_OUTPUT = 2 * 1024 * 1024;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function redact(value) {
  return String(value ?? "")
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/(private[_ -]?key|secret|token|auth[_ -]?tag)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 1000);
}

async function json(pathname) {
  return JSON.parse(await readFile(pathname, "utf8"));
}

async function loadState() {
  try {
    const value = await json(statePath);
    return value && typeof value === "object" ? value : { pendingDrafts: {} };
  } catch {
    return { pendingDrafts: {} };
  }
}

async function saveState(state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function collectProfiles(base, community) {
  return new Map([...(base.profiles ?? []), ...(community.profiles ?? [])].map((profile) => [profile.id, profile]));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["items", "data", "results", "users"]) if (Array.isArray(value[key])) return value[key];
  return [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function command(commandArgs, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(buzz, commandArgs, {
      cwd: root,
      env: { ...process.env, ...env },
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
    }, 30_000);
    const collect = (target, chunk) => {
      bytes += chunk.length;
      if (bytes <= MAX_OUTPUT) target.push(chunk);
      else if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("BUZZ CLI returned too much output."));
      }
    };
    child.stdout.on("data", (chunk) => collect(stdout, chunk));
    child.stderr.on("data", (chunk) => collect(stderr, chunk));
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("BUZZ CLI is not installed or could not start."));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString("utf8").trim();
      const err = Buffer.concat(stderr).toString("utf8").trim();
      if ((code ?? 1) !== 0) reject(new Error(redact(err || out || `BUZZ CLI exited with code ${code}.`)));
      else resolve(out);
    });
  });
}

async function runJson(commandArgs, env) {
  const raw = await command(commandArgs, env);
  try { return JSON.parse(raw || "null"); }
  catch (error) { throw new Error(`BUZZ CLI returned invalid JSON for ${commandArgs.slice(0, 3).join(" ")}.`, { cause: error }); }
}

function humanEnv() {
  return { BUZZ_RELAY_URL: relayUrl, BUZZ_PRIVATE_KEY: humanKey, BUZZ_AUTH_TAG: "" };
}

function provisionerEnv() {
  return {
    BUZZ_RELAY_URL: relayUrl,
    BUZZ_PRIVATE_KEY: provisionerKey,
    BUZZ_AUTH_TAG: provisionerAuthTag,
  };
}

function profilePrompt(profile, publicBio) {
  return [
    `You are ${profile.displayName}, ${profile.title}, an official public Agent for this PlotPickle Community.`,
    publicBio,
    `Responsibility: ${profile.responsibility}`,
    `Authority: ${profile.creativeAuthority}.`,
    `Verification boundary: ${profile.verificationContract}`,
    "Never sign or speak as the connected Human. Never treat BUZZ discussion as accepted PPF canon unless the Human explicitly approves it through PlotPickle.",
  ].join("\n\n");
}

async function main() {
  const [plugin, baseProfiles, communityProfiles, publicProfiles, state] = await Promise.all([
    json(pluginPath),
    json(path.join(root, "config", "agent-profiles.json")),
    json(path.join(root, "config", "agent-profile-extensions", "community.json")),
    json(path.join(root, "config", "agent-profile-extensions", "public.json")),
    loadState(),
  ]);
  if (plugin.schemaVersion !== 1 || !Array.isArray(plugin.rooms) || !Array.isArray(plugin.agents)) {
    throw new Error("Community plugin config is not a supported provisioning contribution.");
  }
  const profiles = collectProfiles(baseProfiles, communityProfiles);
  const plan = plugin.agents.map((extension) => {
    const profile = profiles.get(extension.profileId);
    const presentation = publicProfiles.profiles?.[extension.profileId];
    if (!profile || !presentation) throw new Error(`Community plugin references missing public Agent Profile ${extension.profileId}.`);
    return {
      profileId: extension.profileId,
      displayName: profile.displayName,
      publicBio: presentation.publicBio,
      avatarRef: presentation.avatarRef,
      roomIds: extension.roomIds,
      configuredPubkey: presentation.officialBuzzIdentity?.pubkey || null,
      prompt: profilePrompt(profile, presentation.publicBio),
    };
  });

  const result = {
    schemaVersion: 1,
    communityId: plugin.communityId,
    communityName: plugin.displayName,
    mode: apply ? "apply" : "plan",
    generatedAt: new Date().toISOString(),
    agents: [],
    publicIdentityUpdates: {},
  };

  if (!apply) {
    result.agents = plan.map(({ prompt, ...agent }) => ({ ...agent, promptReady: Boolean(prompt) }));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (!relayUrl || !humanKey) throw new Error("--apply requires BUZZ_RELAY_URL and the Human/admin BUZZ_PRIVATE_KEY in the process environment.");

  const channelRows = asArray(await runJson(["--format", "json", "channels", "list"], humanEnv()));
  const channelByRoom = new Map();
  for (const room of plugin.rooms) {
    const matches = channelRows.filter((candidate) => text(candidate.name) === room.id);
    if (matches.length !== 1) throw new Error(`Expected exactly one BUZZ channel named ${room.id}; found ${matches.length}.`);
    const channelId = text(matches[0].channel_id ?? matches[0].id);
    if (!channelId) throw new Error(`BUZZ channel ${room.id} did not return a channel id.`);
    channelByRoom.set(room.id, channelId);
  }

  state.pendingDrafts ??= {};
  for (const agent of plan) {
    let pubkey = agent.configuredPubkey;
    let status = pubkey ? "configured" : "discovering";
    let requestId = "";

    if (!pubkey) {
      const ownedRaw = await runJson(["--format", "compact", "users", "get", "--name", agent.displayName, "--owner", "me"], humanEnv());
      const matches = asArray(ownedRaw).filter((candidate) => text(candidate.display_name ?? candidate.displayName ?? candidate.name) === agent.displayName);
      if (matches.length > 1) {
        result.agents.push({ profileId: agent.profileId, displayName: agent.displayName, status: "ambiguous-existing-agent", matches: matches.length });
        continue;
      }
      const candidatePubkey = text(matches[0]?.pubkey);
      if (/^[a-f0-9]{64}$/i.test(candidatePubkey)) {
        pubkey = candidatePubkey;
        status = "resolved-existing";
        delete state.pendingDrafts[agent.profileId];
      } else if (state.pendingDrafts[agent.profileId]?.requestId) {
        status = "awaiting-owner-approval";
        requestId = state.pendingDrafts[agent.profileId].requestId;
      } else if (provisionerKey && provisionerAuthTag) {
        const primaryRoomId = agent.roomIds[0];
        const channelId = channelByRoom.get(primaryRoomId);
        const draft = await runJson([
          "agents", "draft-create",
          "--channel", channelId,
          "--display-name", agent.displayName,
          "--system-prompt", agent.prompt,
        ], provisionerEnv());
        requestId = text(draft?.request_id ?? draft?.requestId);
        state.pendingDrafts[agent.profileId] = { requestId, displayName: agent.displayName, requestedAt: new Date().toISOString() };
        status = "awaiting-owner-approval";
      } else {
        status = "owner-provisioner-required";
      }
    }

    if (!pubkey) {
      result.agents.push({ profileId: agent.profileId, displayName: agent.displayName, status, requestId });
      continue;
    }

    result.publicIdentityUpdates[agent.profileId] = pubkey;
    const memberships = [];
    for (const roomId of agent.roomIds) {
      const channelId = channelByRoom.get(roomId);
      const members = asArray(await runJson(["channels", "members", "--channel", channelId], humanEnv()));
      const existing = members.find((member) => text(member.pubkey).toLowerCase() === pubkey.toLowerCase());
      if (existing && text(existing.role) === "bot") {
        memberships.push({ roomId, status: "verified" });
        continue;
      }
      await runJson(["channels", "add-member", "--channel", channelId, "--pubkey", pubkey, "--role", "bot"], humanEnv());
      const verified = asArray(await runJson(["channels", "members", "--channel", channelId], humanEnv()))
        .some((member) => text(member.pubkey).toLowerCase() === pubkey.toLowerCase() && text(member.role) === "bot");
      if (!verified) throw new Error(`BUZZ did not verify ${agent.displayName} as a bot member of ${roomId}.`);
      memberships.push({ roomId, status: existing ? "role-repaired" : "added" });
    }
    result.agents.push({ profileId: agent.profileId, displayName: agent.displayName, pubkey, status: "ready", memberships });
  }

  await saveState(state);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => fail(redact(error instanceof Error ? error.message : error)));
