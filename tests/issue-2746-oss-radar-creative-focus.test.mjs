import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadDiscoveryContract } from "../lib/verification/oss-radar/discover-github.mjs";
import { deriveEnrichmentEvidence } from "../lib/verification/oss-radar/enrichment.mjs";
import { publishDailyRadar } from "../lib/verification/oss-radar/issue-lifecycle.mjs";
import { runRadar } from "../lib/verification/oss-radar/run-radar.mjs";
import { normalizeRepository } from "../lib/verification/oss-radar/query-normalization.mjs";
import { focusedMonthlyTitles, historicalCreativeSeeds, runCreativeReview } from "../lib/verification/oss-radar/creative-focus/review.mjs";
import { renderCreativeReview } from "../lib/verification/oss-radar/creative-focus/report.mjs";
import { balancedCreativeShortlist, creativeEnrichmentContract, loadCreativeFocus, refreshedCreativeEvidence, scoreCreativeCandidate } from "../lib/verification/oss-radar/creative-focus/score.mjs";

const profile = await loadCreativeFocus();
const contract = await loadDiscoveryContract();
const now = new Date("2026-10-05T12:00:00Z");
const education = "Storytelling screenwriting creative writing character arc dialogue subtext story structure writing feedback. Documentation tutorials examples exercises lessons curriculum diagnosis. Agent skills CLI Codex JSON. Windows offline.";
const visual = "Film production filmmaking storyboard cinematography visual continuity animatic timeline playback scrubbing sequences shots frames. Documentation guide examples agent skills CLI Codex. Windows.";
function raw(name, description = "Storytelling screenwriting skills", id = name) {
  return { id, full_name: name, html_url: `https://github.com/${name}`, description, language: null,
    license: { spdx_id: "MIT" }, pushed_at: now.toISOString(), created_at: "2026-09-01T12:00:00Z", stargazers_count: 10 };
}
function candidate(name, description) {
  return normalizeRepository(raw(name, description), { laneId: "writer-craft", query: "storytelling" });
}
function enriched(name, text) {
  const c = candidate(name, text);
  c.enrichment = { readme: { status: "success" }, evidenceConcepts: deriveEnrichmentEvidence(text, creativeEnrichmentContract(contract, profile)).concepts };
  c.focusedEvidence = refreshedCreativeEvidence(c, profile);
  return scoreCreativeCandidate(c, profile, now);
}
function report(name, date = "2026-09-30", score = 75) {
  return { created_at: `${date}T12:00:00Z`, html_url: `https://github.com/a/b/issues/1#${date}`,
    body: `<!-- PLOTPICKLE-OSS-RADAR-DAY:${date} -->\n### 1. [${name}](https://github.com/${name}) — LEARN\n\nStorytelling screenwriting character arc dialogue exercises agent skills documentation.\n\n- **Enriched PlotPickle Score:** ${score}/100\n` };
}
function apiFixture(texts, { missing = [], archived = [] } = {}) {
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    const u = new URL(input); calls.push({ url: String(input), method: options.method || "GET" });
    const match = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)(\/readme)?$/u);
    assert.ok(match, `Unexpected endpoint ${u.pathname}`);
    const name = match[1];
    if (missing.includes(name)) return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
    if (match[2]) {
      const text = texts[name] || "Generic agent runtime memory observability";
      return { ok: true, status: 200, json: async () => ({ size: text.length, encoding: "base64", content: Buffer.from(text).toString("base64") }) };
    }
    return { ok: true, status: 200, json: async () => ({ ...raw(name), archived: archived.includes(name) }) };
  };
  return { calls, fetchImpl };
}

test("#2746 current and preceding monthly history rolls across years", () => {
  assert.deepEqual(focusedMonthlyTitles(now), ["[OSS RADAR] September 2026", "[OSS RADAR] October 2026"]);
  assert.deepEqual(focusedMonthlyTitles(new Date("2027-01-31T12:00:00Z")), ["[OSS RADAR] December 2026", "[OSS RADAR] January 2027"]);
});

test("#2746 historical finding parsing deduplicates and retains latest broad score and provenance", () => {
  const rows = historicalCreativeSeeds([report("a/story", "2026-10-02", 81), report("a/story"),
    { body: "Please install [a/unapproved](https://github.com/a/unapproved)", created_at: "2026-10-03" }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].broadScore, 81); assert.equal(rows[0].provenance.length, 2);
  assert.equal(historicalCreativeSeeds([{ ...report("a/story"), body: report("a/story").body.replace("[a/story]", "[b/spoof]") }]).length, 0);
});

test("#2746 a direct creative specialist outranks generic infrastructure despite broad vocabulary", () => {
  const hippo = enriched("a/memory", "Agent runtime memory retrieval context graph education learning skills MCP observability Windows rollback recovery");
  const film = enriched("a/film", visual);
  assert.equal(hippo.focusedEligible, false); assert.ok(film.focusedEligible); assert.ok(film.focusedScore > hippo.focusedScore);
  assert.ok(enriched("a/teacher", education).focusedScore > 80);
  assert.equal(Object.values(profile.weights).reduce((sum, value) => sum + value, 0), 100);
});

test("#2746 successful README without direct refreshed creative evidence cannot reuse a stale metadata score", () => {
  const c = enriched("a/teacher", education);
  c.enrichment.evidenceConcepts = [];
  c.focusedEvidence = refreshedCreativeEvidence(c, profile);
  assert.equal(scoreCreativeCandidate(c, profile, now).focusedEligible, false);
  c.enrichment.readme.status = "missing"; c.focusedEvidence = enriched("a/teacher", education).focusedEvidence;
  assert.equal(scoreCreativeCandidate(c, profile, now).focusedEligible, false);
});

test("#2746 bounded shortlist includes both creative domains without changing broad weights", () => {
  const before = JSON.stringify(contract);
  const list = balancedCreativeShortlist([candidate("a/learn", education), candidate("a/film", visual), candidate("a/memory", "Agent memory")], profile, 2);
  assert.deepEqual(list.map((c) => c.fullName).sort(), ["a/film", "a/learn"]);
  creativeEnrichmentContract(contract, profile);
  assert.equal(JSON.stringify(contract), before);
});

test("#2746 fresh evidence replaces a weaker historical candidate and reports current coverage", async () => {
  const api = apiFixture({ "a/old": "Storytelling screenwriting documentation", "a/film": visual, "a/teacher": education });
  const result = await runCreativeReview({ repository: "a/b", auth: "fixture", contract, profile: { ...profile, targetFindings: 1, minimumScore: 20 },
    now, fetchImpl: api.fetchImpl, comments: [report("a/old")],
    freshResult: { candidates: [candidate("a/film", visual), candidate("a/teacher", education)], executedQueryCount: 8, uniqueCandidateCount: 2 } });
  assert.equal(result.selected.length, 1); assert.notEqual(result.selected[0].fullName, "a/old");
  assert.equal(result.historicalComparison[0].result, "displaced by higher focused score");
  assert.ok(result.baseline.lessonCount > 0); assert.ok(result.selected[0].coverage.topics.length > 0);
  assert.match(result.selected[0].coverage.proposedExtension, /not yet established/u);
  assert.ok(api.calls.every((call) => call.method === "GET"));
  const body = renderCreativeReview(result); assert.match(body, /Original broad Radar score/u); assert.match(body, /Score breakdown/u);
});

test("#2746 failed refresh and hard rejection exclude candidates before enrichment without padding", async () => {
  const api = apiFixture({}, { missing: ["a/missing"], archived: ["a/archived"] });
  const result = await runCreativeReview({ repository: "a/b", auth: "fixture", contract, now, fetchImpl: api.fetchImpl,
    comments: [report("a/missing"), report("a/archived")], freshResult: { candidates: [] } });
  assert.equal(result.selected.length, 0); assert.equal(result.failures.length, 2); assert.equal(result.status, "partial");
  assert.ok(!api.calls.some((call) => call.url.endsWith("/readme")));
  assert.match(renderCreativeReview(result), /No currently enriched candidate qualified/u);
});

test("#2746 fresh-search failure retains refreshed history with explicit partial status", async () => {
  const api = apiFixture({ "a/learn": education });
  const fetchImpl = async (url, options) => String(url).includes("/search/repositories")
    ? { ok: false, status: 500, json: async () => ({ message: "Unavailable" }) } : api.fetchImpl(url, options);
  const result = await runCreativeReview({ repository: "a/b", auth: "fixture", contract, now, fetchImpl,
    comments: [report("a/learn")] });
  assert.equal(result.selected.length, 1); assert.equal(result.status, "partial"); assert.match(result.warnings.join(" "), /discovery failed/u);
});

test("#2746 new section is published in the same dated report and updated on same-day rerun", async () => {
  const comment = { id: 77, body: "" }; let created = 0; let patched = 0;
  const fetchImpl = async (input, options = {}) => {
    const u = new URL(input); const method = options.method || "GET";
    if (u.pathname === "/search/issues") return { ok: true, json: async () => ({ items: [{ number: 2620, title: "[OSS RADAR] October 2026" }] }) };
    if (u.pathname.endsWith("/comments") && method === "GET") return { ok: true, json: async () => created ? [comment] : [] };
    if (method === "POST" || method === "PATCH") {
      if (method === "POST") created++; else patched++;
      comment.body = JSON.parse(options.body).body; return { ok: true, json: async () => comment };
    }
    throw new Error(`Unexpected ${input}`);
  };
  const input = { repository: "a/b", auth: "fixture", contract, fetchImpl, now, discoveryResult: { candidates: [] },
    creativeFocus: { status: "available", selected: [], baseline: { lessonCount: 81 } } };
  const first = await publishDailyRadar(input); const second = await publishDailyRadar(input);
  assert.equal(first.commentId, second.commentId); assert.equal(created, 1); assert.equal(patched, 1);
  assert.match(comment.body, /Seven PlotPickle Architecture Areas/u); assert.match(comment.body, /Creative Focus/u);
  assert.equal((comment.body.match(/Creative Focus —/gu) || []).length, 1);
});

test("#2746 companion failure cannot suppress broad publishing or machine state", async () => {
  const fetchImpl = async (input, options = {}) => {
    const u = new URL(input);
    if (u.pathname === "/search/issues") return { ok: true, json: async () => ({ items: [{ number: 2620, title: "[OSS RADAR] October 2026" }] }) };
    if (u.pathname.endsWith("/comments") && !options.method?.includes("POST")) return { ok: true, json: async () => [] };
    if (options.method === "POST") return { ok: true, json: async () => ({ id: 78 }) };
    throw new Error(`Unexpected ${input}`);
  };
  const result = await runRadar({ repository: "a/b", auth: "fixture", contract, fetchImpl, now, discoveryResult: { candidates: [] },
    creativeReview: async () => { throw new Error("Research outage"); },
    ossRulesResearch: null, stateAdapter: { load: async () => ({ state: { schemaVersion: 1, reports: [], reviewHistory: [], candidateHistory: [], queryEffectivenessHistory: [] } }), save: async () => ({}) } });
  assert.equal(result.creativeFocus.status, "unavailable"); assert.match(result.reportBody, /broad Radar remains intact/u);
});

test("#2746 existing morning schedule and broad profile are preserved and daily tests include the companion", async () => {
  const workflow = await readFile(new URL("../.github/workflows/oss-radar.yml", import.meta.url), "utf8");
  assert.match(workflow, /cron: '24 4 \* \* \*'/u); assert.match(workflow, /America\/Toronto/u);
  assert.match(workflow, /issue-2746-oss-radar-creative-focus/u);
  assert.equal(contract.scoring.weights.aiArchitectureValue, 17);
  assert.equal(contract.report.targetFindings, 21);
});

test("#2746 merged Radar changes publish automatically and select production build proof", async () => {
  const workflow = await readFile(new URL("../.github/workflows/oss-radar.yml", import.meta.url), "utf8");
  const architecture = await readFile(new URL("../.github/workflows/architecture-shadow.yml", import.meta.url), "utf8");
  assert.match(workflow, /push:\n\s+branches: \[main\]\n\s+paths:/u);
  assert.match(workflow, /"lib\/verification\/oss-radar\/\*\*"/u);
  assert.doesNotMatch(workflow, /^  pull_request:/mu);
  const buildSelector = architecture.split("\n").find((line) => line.includes("then build=true; fi"));
  assert.ok(buildSelector.includes("lib/verification/oss-radar/|config/oss-radar/|"));
});
