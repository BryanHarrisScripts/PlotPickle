import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { researchOssRules } from "../lib/verification/oss-radar/oss-rules/intelligence.mjs";
import { writeRadarArtifactBundle } from "../lib/verification/oss-radar/artifact-bundle.mjs";
import { renderDailyReport } from "../lib/verification/oss-radar/report-renderer.mjs";
import { publishDailyRadar } from "../lib/verification/oss-radar/issue-lifecycle.mjs";

const sha = "a".repeat(40);
const projectApi = "https://ossrules.md/api/v1/projects/example/project";
const candidate = { fullName: "example/project", selectedArchitectureArea: { label: "Validation & Operations" } };
function response(value, status = 200) { return { ok: status === 200, status, text: async () => typeof value === "string" ? value : JSON.stringify(value) }; }

test("#2348 expands only a selected exact-match summary and retains a pinned source", async () => {
  const calls = [];
  const fetchImpl = async (input) => {
    const url = new URL(input); calls.push(url.pathname + url.search);
    if (url.pathname === "/llms.txt") return response("# ossrules.md\nStart with the catalog overview.");
    if (url.pathname === "/api/v1/catalog") return response({ version: 1, links: { projects: "https://ossrules.md/api/v1/projects" } });
    if (url.pathname === "/api/v1/projects") return response({ items: [
      { repository: "different/project", patterns: ["verification-matrix"], apiUrl: "https://ossrules.md/api/v1/projects/different/project" },
      { repository: "example/project", patterns: ["verification-matrix"], apiUrl: projectApi },
    ] });
    if (url.href === projectApi) return response({ repository: "example/project", instructions: { sha, primaryPath: "AGENTS.md" } });
    if (url.pathname === "/api/v1/patterns/verification-matrix") return response({ name: "Verification by change type", summary: "Choose checks for the changed behavior.", examples: [] });
    throw Error(`Unexpected request: ${url}`);
  };
  const result = await researchOssRules({ candidates: [candidate], fetchImpl });
  assert.equal(result.status, "available");
  assert.equal(result.repositoriesChecked, 1);
  assert.equal(result.findings[0].disposition, "ADAPT");
  assert.equal(result.findings[0].sourceUrl, `https://github.com/example/project/blob/${sha}/AGENTS.md`);
  assert.ok(calls.indexOf("/llms.txt") < calls.indexOf("/api/v1/catalog"));
  assert.ok(calls.some((call) => call === "/api/v1/projects?q=example%2Fproject&limit=5"));
  assert.equal(calls.some((call) => call.includes("different/project")), false);
});

test("#2348 unavailable OSS Rules leaves the ordinary report path usable", async () => {
  const result = await researchOssRules({ candidates: [candidate], fetchImpl: async () => response("unavailable", 503) });
  assert.equal(result.status, "unavailable");
  assert.deepEqual(result.findings, []);
  const rendered = renderDailyReport({ reportDate: "2026-09-23", selection: { selected: [], belowThreshold: [], reviewQueue: [], target: 0 },
    contract: { runtimeRadar: { discovery: {} } }, ossRules: result });
  assert.match(rendered.body, /OSS Rules — Agent Instruction Intelligence/u);
  assert.match(rendered.body, /enrichment unavailable/u);
});

test("#2348 evidence artifact contains bounded metadata without third-party instruction bodies", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-oss-rules-"));
  try {
    const resultPath = path.join(directory, "result.json");
    await writeFile(resultPath, JSON.stringify({ ossRulesIntelligence: { schemaVersion: 1, status: "available", findings: [
      { repository: "example/project", patternId: "verification-matrix", sourceSha: sha, sourceUrl: `https://github.com/example/project/blob/${sha}/AGENTS.md` }
    ], checks: [] } }));
    await writeRadarArtifactBundle({ resultPath, outputDir: path.join(directory, "artifact") });
    const artifact = JSON.parse(await readFile(path.join(directory, "artifact", "oss-rules-intelligence.json"), "utf8"));
    assert.equal(artifact.findings[0].sourceSha, sha);
    assert.equal(Object.hasOwn(artifact.findings[0], "instructionBody"), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("#2348 publishes GitHub-selected findings before optional OSS Rules enrichment", async () => {
  const contract = JSON.parse(await readFile(new URL("../config/oss-radar/discovery-contract.json", import.meta.url), "utf8"));
  const fixture = JSON.parse(await readFile(new URL("./fixtures/oss-radar/phase-2-report-candidates.json", import.meta.url), "utf8"));
  contract.runtimeRadar = { discovery: {} };
  let selectedForResearch = [];
  let publishedBody = "";
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname === "/search/issues") return { ok: true, json: async () => ({ items: [{ number: 42, title: "[OSS RADAR] September 2026" }] }) };
    if (url.pathname.endsWith("/issues/42/comments") && options.method === "POST") {
      publishedBody = JSON.parse(options.body).body;
      return { ok: true, json: async () => ({ id: 100 }) };
    }
    if (url.pathname.endsWith("/issues/42/comments")) return { ok: true, json: async () => [] };
    throw Error(`Unexpected GitHub request: ${url.pathname}`);
  };
  const published = await publishDailyRadar({ repository: "BryanHarrisScripts/PlotPickle", auth: "fixture-token", contract,
    discoveryResult: { candidates: fixture.candidates }, now: new Date("2026-09-23T12:00:00Z"), fetchImpl,
    ossRulesResearch: async ({ candidates }) => {
      selectedForResearch = candidates.map((item) => item.fullName);
      return { schemaVersion: 1, status: "unavailable", repositoriesChecked: 0, findings: [], checks: [] };
    } });
  assert.equal(selectedForResearch.length, contract.report.targetFindings);
  assert.equal(selectedForResearch.length < fixture.candidates.length, true);
  assert.equal(published.reviewCount, contract.report.targetFindings);
  assert.match(publishedBody, /OSS Rules — Agent Instruction Intelligence/u);
});
