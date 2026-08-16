import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeLiveBuzzActivity, postLiveBuzzActivity } from "../scripts/buzz-live-activity.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("live BUZZ activity routes the key PlotPickle actors into their Guildhall rooms", () => {
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

test("live BUZZ activity posts only compact operational metadata through the local gateway", async () => {
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
    summary: "Sage completed a curriculum turn.",
    severity: "info",
    target: "curriculum-guide",
    verified: true,
    actionable: false,
  }, { baseUrl: "http://127.0.0.1:4173", fetchImpl: fakeFetch });

  assert.equal(result.ok, true);
  assert.equal(result.channel, "lore-library");
  assert.equal(calls.length, 2);
  const posted = JSON.parse(calls[1].init.body);
  assert.equal(posted.channel, "room-12345678");
  assert.match(posted.content, /Sage Brinewick · Lorekeeper/);
  assert.match(posted.content, /route=lore-library/);
  assert.doesNotMatch(posted.content, /private key|full prompt|hidden reasoning/i);
});

test("Mastra chat responses are mirrored into BUZZ without turning BUZZ into the agent runtime", async () => {
  const [mirror, gateway] = await Promise.all([
    read("build/buzz-agent-activity-mirror.ts"),
    read("build/local-ai-gateway.ts"),
  ]);
  for (const token of ["curriculum-guide", "sage-brinewick", "foundations-planner", "wyrmwood-rival-director", "master-oaken-vague", "wyrmwood-curriculum-evaluator", "rowan-scalequill", "creative-director", "quillan-reedcloak"]) {
    assert.match(mirror, new RegExp(token));
  }
  assert.match(mirror, /postBuzzGuildhallEvent/);
  assert.match(mirror, /\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(mirror, /agents.*draft-create|BUZZ_PRIVATE_KEY/);
  assert.ok(gateway.indexOf("registerBuzzAgentActivityMirror(server)") < gateway.indexOf("registerWritingAssistantGateway(server)"));
});

test("Writer, UAT, repair, visual findings and GitHub reporters all emit live BUZZ activity", async () => {
  const [writerRecovery, writerReporter, closedLoop, uatReporter] = await Promise.all([
    read("scripts/writer-in-residence-runtime-recovery.mjs"),
    read("scripts/report-writer-in-residence.mjs"),
    read("scripts/run-uat-closed-loop.mjs"),
    read("scripts/report-uat-findings.mjs"),
  ]);
  assert.match(writerRecovery, /bestEffortLiveBuzzActivity/);
  assert.match(writerRecovery, /actorId: "avery-north"/);
  assert.match(writerRecovery, /type: "writer\.feedback"/);
  assert.match(writerReporter, /rendered-visual-observer/);
  assert.match(writerReporter, /type: visual \? "visual\.finding" : "writer\.feedback"/);
  assert.match(writerReporter, /type: "github\.status"/);
  assert.match(closedLoop, /type: "uat\.result"/);
  assert.match(closedLoop, /type: "repair\.request"/);
  assert.match(uatReporter, /actorId: "bram-gatewick"/);
  assert.match(uatReporter, /actorId: "rook-ironquill"/);
  assert.match(uatReporter, /actorId: "fen-copperwind"/);
});

test("the real local verifier writes and reads back all seven important activity routes", async () => {
  const verifier = await read("scripts/verify-buzz-live-activity.mjs");
  for (const room of ["lore-library", "wayfarer-journal", "wyrmwood-ring", "lantern-watch", "gatehouse", "forge", "github-herald"]) {
    assert.match(verifier, new RegExp(room));
  }
  assert.match(verifier, /postLiveBuzzActivity/);
  assert.match(verifier, /\/messages\?channel=/);
  assert.match(verifier, /BUZZ LIVE ACTIVITY PASS/);
  assert.match(verifier, /7\/\$\{probes\.length\}|verified\.length/);
});
