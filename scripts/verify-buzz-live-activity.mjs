#!/usr/bin/env node

import process from "node:process";
import { normalizeLiveBuzzActivity } from "./buzz-live-activity.mjs";
import { withTransientBuzzRetry } from "./buzz-verification-retry.mjs";
import { verificationAuthRequestHeaders } from "./full-verification-auth.mjs";

const baseUrl = String(process.env.PLOTPICKLE_URL || process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");

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
    headers: { Accept: "application/json", ...verificationAuthRequestHeaders(baseUrl, "GET") },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || `PlotPickle BUZZ gateway returned ${response.status}.`);
  return body;
}

const localHealth = await withTransientBuzzRetry(() => request("/live-health"));
if (!localHealth?.ok || !localHealth?.localBackbone) {
  throw new Error("PlotPickle local BUZZ coordination health did not return bounded backbone evidence.");
}
process.stdout.write(`BUZZ local backbone ................. PASS  ${localHealth.localBackbone.state || "ready"}\n`);

for (const probe of probes) {
  const normalized = normalizeLiveBuzzActivity({ type: probe.type, actorId: probe.actorId, summary: `${probe.label} activity contract.` });
  if (normalized.channel.name !== probe.expectedChannel) {
    throw new Error(`${probe.label} activity route changed from ${probe.expectedChannel} to ${normalized.channel.name}.`);
  }
  process.stdout.write(`BUZZ local activity · ${probe.label.padEnd(15)} PASS  ${probe.expectedChannel}\n`);
}

process.stdout.write("BUZZ LIVE ACTIVITY PASS: local operational routes verified; no Agent/test event was published through the Human signer.\n");
