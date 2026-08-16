#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const config = JSON.parse(await readFile(path.join(root, "config", "buzz-guildhall.json"), "utf8"));
const appUrl = String(process.env.PLOTPICKLE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");

function option(name, fallback = "") {
  const prefix = `${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function clean(value, limit) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[redacted-github-token]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/g, "[redacted-api-key]")
    .replace(/((?:password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*)\S+/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

async function stdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function inputEvent() {
  if (hasFlag("--stdin")) {
    const raw = await stdinText();
    if (!raw) throw new Error("--stdin expected one JSON event on standard input.");
    return JSON.parse(raw);
  }
  const evidence = process.argv
    .filter((value) => value.startsWith("--evidence="))
    .map((value) => value.slice("--evidence=".length))
    .flatMap((value) => {
      const split = value.indexOf("|");
      return split > 0 ? [{ label: value.slice(0, split), ref: value.slice(split + 1) }] : [];
    });
  return {
    type: option("--type"),
    actorId: option("--actor"),
    summary: option("--summary"),
    severity: option("--severity", "info"),
    projectId: option("--project"),
    target: option("--target"),
    verified: hasFlag("--verified"),
    actionable: hasFlag("--actionable"),
    evidence,
    occurredAt: new Date().toISOString(),
  };
}

function normalize(event) {
  const actor = config.actors.find((item) => item.id === event.actorId);
  if (!actor) throw new Error(`Unknown Guildhall actor: ${event.actorId || "(missing)"}.`);
  const channelId = config.eventRoutes[event.type];
  if (!channelId) throw new Error(`Unknown Guildhall event type: ${event.type || "(missing)"}.`);
  const channel = config.channels.find((item) => item.id === channelId);
  if (!channel) throw new Error(`Guildhall event route ${event.type} points to a missing channel.`);
  const summary = clean(event.summary, 700);
  if (!summary) throw new Error("Guildhall event summary is required.");
  const severity = ["info", "low", "medium", "high", "critical"].includes(event.severity) ? event.severity : "info";
  const evidence = Array.isArray(event.evidence) ? event.evidence.slice(0, 8).flatMap((entry) => {
    const label = clean(entry?.label, 120);
    const ref = clean(entry?.ref, 500);
    return label && ref ? [{ label, ref }] : [];
  }) : [];
  return {
    actor,
    channel,
    event: {
      type: event.type,
      actorId: actor.id,
      summary,
      severity,
      projectId: clean(event.projectId, 160),
      target: clean(event.target, 220),
      verified: event.verified === true,
      actionable: event.actionable === true,
      evidence,
      occurredAt: new Date(event.occurredAt || Date.now()).toISOString(),
    },
  };
}

function format({ actor, channel, event }) {
  const lines = [
    `[${actor.displayName} · ${actor.title}]`,
    event.summary,
    `type=${event.type} severity=${event.severity} verified=${event.verified ? "yes" : "no"} actionable=${event.actionable ? "yes" : "no"}`,
  ];
  if (event.projectId) lines.push(`project=${event.projectId}`);
  if (event.target) lines.push(`target=${event.target}`);
  for (const evidence of event.evidence) lines.push(`evidence: ${evidence.label} — ${evidence.ref}`);
  lines.push(`occurred=${event.occurredAt}`);
  lines.push(`route=${channel.name}`);
  return lines.join("\n");
}

async function request(pathname, init) {
  const response = await fetch(`${appUrl}/api/local-buzz${pathname}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) },
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || `PlotPickle BUZZ gateway returned ${response.status}.`);
  return body;
}

const normalized = normalize(await inputEvent());
const rooms = await request("/rooms");
const channel = (rooms.rooms || []).find((room) => room.name === normalized.channel.name);
if (!channel?.id) {
  process.stderr.write(`Guildhall room '${normalized.channel.name}' is missing. Run scripts/bootstrap-buzz-guildhall.mjs first.\n`);
  process.exit(2);
}
await request("/messages", {
  method: "POST",
  body: JSON.stringify({ channel: channel.id, content: format(normalized) }),
});
process.stdout.write(`${JSON.stringify({ ok: true, actor: normalized.actor.id, eventType: normalized.event.type, channel: normalized.channel.name })}\n`);
