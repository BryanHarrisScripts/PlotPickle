import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { bestEffortLiveBuzzActivity, normalizeLiveBuzzActivity, postLiveBuzzActivity } from "../scripts/buzz-live-activity.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("PlotPickle activity still maps deterministically to its local Guildhall routes", () => {
  const expected = [
    ["curriculum.note", "sage-brinewick", "lore-library"],
    ["writer.feedback", "avery-north", "wayfarer-journal"],
    ["wyrmwood.result", "master-oaken-vague", "wyrmwood-ring"],
    ["visual.finding", "luma-glassfern", "lantern-watch"],
    ["uat.result", "bram-gatewick", "gatehouse"],
    ["repair.request", "rook-ironquill", "forge"],
    ["github.status", "fen-copperwind", "github-herald"],
  ];
  for (const [type, actorId, channel] of expected) {
    const normalized = normalizeLiveBuzzActivity({ type, actorId, summary: `${actorId} test` });
    assert.equal(normalized.channel.name, channel);
    assert.equal(normalized.actor.id, actorId);
  }
});

test("best-effort operational activity records locally and never falls back to the Human BUZZ signer", async () => {
  const localRoot = await mkdtemp(path.join(tmpdir(), "plotpickle-buzz-local-"));
  try {
    const result = await bestEffortLiveBuzzActivity({
      type: "uat.result",
      actorId: "bram-gatewick",
      summary: "UAT evidence stays local.",
      verified: true,
      actionable: false,
    }, { localRoot });
    assert.equal(result.ok, true);
    assert.equal(result.localRecorded, true);
    assert.equal(result.buzzMirrored, false);
    assert.equal(result.reason, "agent-signer-required");
  } finally {
    await rm(localRoot, { recursive: true, force: true });
  }
});

test("explicit compatibility round-trip helper remains bounded but is not the operational fallback", async () => {
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/api/local-buzz/rooms")) {
      return new Response(JSON.stringify({ ok: true, rooms: [{ id: "room-12345678", name: "lore-library" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await postLiveBuzzActivity({
    type: "curriculum.note",
    actorId: "sage-brinewick",
    summary: "Explicit compatibility probe.",
  }, { baseUrl: "http://127.0.0.1:4173", fetchImpl: fakeFetch });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
});

test("Mastra runtime no longer mirrors Agent turns through the Human message endpoint", async () => {
  const [mirror, gateway] = await Promise.all([
    read("build/buzz-agent-activity-mirror.ts"),
    read("build/local-ai-gateway.ts"),
  ]);
  for (const token of ["curriculum-guide", "sage-brinewick", "foundations-planner", "wyrmwood-rival-director", "master-oaken-vague", "wyrmwood-curriculum-evaluator", "rowan-scalequill", "creative-director", "quillan-reedcloak"]) {
    assert.match(mirror, new RegExp(token));
  }
  assert.match(mirror, /connected Human signer is never used as an Agent fallback/);
  assert.doesNotMatch(mirror, /postBuzzGuildhallEvent|BUZZ_PRIVATE_KEY|\/api\/local-buzz\/messages/);
  assert.ok(gateway.indexOf("registerBuzzAgentActivityMirror(server)") < gateway.indexOf("registerWritingAssistantGateway(server)"));
});

test("Writer UAT repair and visual reporters keep recording bounded local activity", async () => {
  const [writerRecovery, writerReporter, closedLoop, uatReporter] = await Promise.all([
    read("scripts/writer-in-residence-runtime-recovery.mjs"),
    read("scripts/report-writer-in-residence.mjs"),
    read("scripts/run-uat-closed-loop.mjs"),
    read("scripts/report-uat-findings.mjs"),
  ]);
  assert.match(writerRecovery, /bestEffortLiveBuzzActivity/);
  assert.match(writerReporter, /bestEffortLiveBuzzActivity/);
  assert.match(closedLoop, /bestEffortLiveBuzzActivity/);
  assert.match(uatReporter, /bestEffortLiveBuzzActivity/);
});

test("the real verifier validates local routes without publishing synthetic Agent traffic", async () => {
  const verifier = await read("scripts/verify-buzz-live-activity.mjs");
  for (const room of ["lore-library", "wayfarer-journal", "wyrmwood-ring", "lantern-watch", "gatehouse", "forge", "github-herald"]) {
    assert.match(verifier, new RegExp(room));
  }
  assert.match(verifier, /normalizeLiveBuzzActivity/);
  assert.doesNotMatch(verifier, /postLiveBuzzActivity|\/messages\?channel=/);
  assert.match(verifier, /no Agent\/test event was published through the Human signer/);
});
