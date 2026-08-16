#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import process from "node:process";
import { postLiveBuzzActivity } from "./buzz-live-activity.mjs";

const baseUrl = String(process.env.PLOTPICKLE_URL || process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const tag = `plotpickle-live-activity:${randomUUID()}`;

const probes = [
  { type: "curriculum.note", actorId: "sage-brinewick", label: "Sage", expectedChannel: "lore-library" },
  { type: "writer.feedback", actorId: "avery-north", label: "Avery", expectedChannel: "wayfarer-journal" },
  { type: "wyrmwood.result", actorId: "master-oaken-vague", label: "Wyrmwood", expectedChannel: "wyrmwood-ring" },
  { type: "visual.finding", actorId: "luma-glassfern", label: "Visual observer", expectedChannel: "lantern-watch" },
  { type: "uat.result", actorId: "bram-gatewick", label: "UAT", expectedChannel: "gatehouse" },
  { type: "repair.request", actorId: "rook-ironquill", label: "Repair", expectedChannel: "forge" },
  { type: "github.status", actorId: "fen-copperwind", label: "GitHub", expectedChannel: "github-herald" },
];

async function request(pathname) {
  const response = await fetch(`${baseUrl}/api/local-buzz${pathname}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || `PlotPickle BUZZ gateway returned ${response.status}.`);
  return body;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const rooms = await request("/rooms");
const roomByName = new Map((rooms.rooms || []).map((room) => [room.name, room]));
for (const probe of probes) {
  if (!roomByName.get(probe.expectedChannel)?.id) throw new Error(`Guildhall room '${probe.expectedChannel}' is missing.`);
}

for (const probe of probes) {
  await postLiveBuzzActivity({
    type: probe.type,
    actorId: probe.actorId,
    summary: `${tag} · ${probe.label} live activity verification.`,
    severity: "info",
    target: "live-activity-verification",
    verified: true,
    actionable: false,
  }, { baseUrl });
}

const verified = [];
for (const probe of probes) {
  const room = roomByName.get(probe.expectedChannel);
  let found = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt) await sleep(350);
    const messages = await request(`/messages?channel=${encodeURIComponent(room.id)}&limit=40`);
    if ((messages.messages || []).some((message) => String(message.content || "").includes(tag))) {
      found = true;
      break;
    }
  }
  if (!found) throw new Error(`${probe.label} activity was sent to ${probe.expectedChannel}, but the same signed message was not readable there.`);
  verified.push(probe.expectedChannel);
  process.stdout.write(`BUZZ live activity · ${probe.label.padEnd(15)} PASS  ${probe.expectedChannel}\n`);
}

process.stdout.write(`BUZZ LIVE ACTIVITY PASS: ${verified.length}/${probes.length} PlotPickle activity routes were written and read back.\n`);
