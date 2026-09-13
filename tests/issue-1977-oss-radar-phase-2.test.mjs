import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  dailyMarker,
  encodeDailyState,
  findDailyComment,
  historyEntryForFinding,
  monthlyIssueTitle,
  parseDailyState,
  reconstructHistory,
  shouldResurface,
} from "../lib/verification/oss-radar/history.mjs";
import { publishDailyRadar } from "../lib/verification/oss-radar/issue-lifecycle.mjs";
import { renderDailyReport, selectDailyFindings } from "../lib/verification/oss-radar/report-renderer.mjs";

const contract = JSON.parse(await readFile("config/oss-radar/discovery-contract.json", "utf8"));
const fixture = JSON.parse(await readFile("tests/fixtures/oss-radar/phase-2-report-candidates.json", "utf8"));
const reportDate = new Date(fixture.reportDate);

function selection(candidates = fixture.candidates, history = new Map(), date = reportDate) {
  return selectDailyFindings({ candidates, contract, history, reportDate: date });
}

function dailyComment(date, candidates) {
  const selected = selection(candidates, new Map(), new Date(`${date}T12:00:00Z`));
  return renderDailyReport({ reportDate: date, selection: selected, contract, history: new Map() }).body;
}

test("#1977 Phase 2 titles monthly issue in UTC", () => {
  assert.equal(monthlyIssueTitle(new Date("2026-09-30T23:59:59Z")), "[OSS RADAR] September 2026");
  assert.equal(monthlyIssueTitle(new Date("2026-10-01T00:00:00Z")), "[OSS RADAR] October 2026");
});

test("#1977 Phase 2 selects five genuine findings and never pads", () => {
  const full = selection();
  assert.equal(full.selected.length, 5);
  assert.equal(full.target, 5);
  assert.ok(full.selected.every((candidate) => candidate.primaryDisposition === "WATCH"));
  const short = selection(fixture.candidates.slice(0, 2));
  assert.equal(short.selected.length, 2);
  const rendered = renderDailyReport({ reportDate, selection: short, contract, history: new Map() });
  assert.match(rendered.body, /Only 2 findings qualified/u);
  assert.match(rendered.body, /What can PlotPickle learn from this\?/u);
  const none = selection([fixture.candidates.at(-1)]);
  assert.equal(none.selected.length, 0);
  assert.match(renderDailyReport({ reportDate, selection: none, contract, history: new Map() }).body, /No repository qualified/u);
});

test("#1977 Phase 2 unknown-license evidence remains conservative", () => {
  const unknown = fixture.candidates.find((candidate) => candidate.repositoryStableId === "206");
  const result = selection([unknown]);
  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0].primaryDisposition, "WATCH");
  assert.ok(unknown.score < contract.scoring.surfaceThreshold);
  assert.ok(unknown.score >= contract.scoring.watchEvidenceThreshold);
});

test("#1977 Phase 2 state and history remain deterministic", () => {
  const candidate = { ...fixture.candidates[0], primaryDisposition: "WATCH" };
  const entry = historyEntryForFinding(candidate, "2026-09-12", null);
  const marker = encodeDailyState({ schemaVersion: 1, date: "2026-09-12", entries: [entry] });
  assert.equal(parseDailyState(`text\n${marker}`).entries[0].repositoryStableId, "201");
  assert.equal(parseDailyState("unrelated comment"), null);
  const comments = [{ id: 1, body: `${dailyMarker("2026-09-12")}\n${marker}` }];
  assert.equal(reconstructHistory(comments, { beforeDate: "2026-09-12" }).size, 0);
  assert.equal(reconstructHistory(comments, { beforeDate: "2026-09-13" }).get("201").fullName, candidate.fullName);
  assert.equal(findDailyComment(comments, "2026-09-12").id, 1);
});

test("#1977 Phase 2 suppression and material-change rules remain intact", () => {
  const candidate = fixture.candidates[0];
  const prior = historyEntryForFinding({ ...candidate, primaryDisposition: "WATCH" }, "2026-09-12", null);
  const history = new Map([[String(candidate.repositoryStableId), prior]]);
  const suppressed = selection([candidate], history, new Date("2026-09-13T12:00:00Z"));
  assert.equal(suppressed.selected.length, 0);
  assert.equal(suppressed.suppressed.history, 1);
  assert.equal(shouldResurface({ ...candidate, score: candidate.score + 5 }, prior, "2026-09-13").reason, "score-change");
  assert.equal(shouldResurface({ ...candidate, matchedLaneIds: ["writer-craft", "learn-education"] }, prior, "2026-09-13").reason, "category-change");
});

function githubIssueFixture({ issues = [], comments = {}, failSearch = false } = {}) {
  const state = {
    issues: structuredClone(issues),
    comments: new Map(Object.entries(comments).map(([key, value]) => [Number(key), structuredClone(value)])),
    calls: [], nextIssue: 1000, nextComment: 5000,
  };
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = options.method || "GET";
    state.calls.push({ method, pathname: url.pathname });
    const json = options.body ? JSON.parse(options.body) : null;
    if (url.pathname === "/search/issues" && method === "GET") {
      if (failSearch) return { ok: false, status: 500, json: async () => ({ message: "fixture search failure" }) };
      return { ok: true, status: 200, json: async () => ({ items: state.issues }) };
    }
    const commentsMatch = url.pathname.match(/^\/repos\/BryanHarrisScripts\/PlotPickle\/issues\/(\d+)\/comments$/u);
    if (commentsMatch && method === "GET") return { ok: true, status: 200, json: async () => state.comments.get(Number(commentsMatch[1])) || [] };
    if (commentsMatch && method === "POST") {
      const number = Number(commentsMatch[1]);
      const comment = { id: state.nextComment++, body: json.body };
      state.comments.set(number, [...(state.comments.get(number) || []), comment]);
      return { ok: true, status: 201, json: async () => comment };
    }
    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle/issues" && method === "POST") {
      const issue = { number: state.nextIssue++, title: json.title, body: json.body, created_at: "2026-10-01T12:00:00Z" };
      state.issues.unshift(issue); state.comments.set(issue.number, []);
      return { ok: true, status: 201, json: async () => issue };
    }
    const updateMatch = url.pathname.match(/^\/repos\/BryanHarrisScripts\/PlotPickle\/issues\/comments\/(\d+)$/u);
    if (updateMatch && method === "PATCH") {
      const id = Number(updateMatch[1]);
      for (const [issueNumber, list] of state.comments) {
        const index = list.findIndex((comment) => comment.id === id);
        if (index >= 0) {
          const updated = { ...list[index], body: json.body };
          list[index] = updated; state.comments.set(issueNumber, list);
          return { ok: true, status: 200, json: async () => updated };
        }
      }
    }
    throw new Error(`Unexpected fixture request ${method} ${url.pathname}`);
  };
  return { state, fetchImpl };
}

test("#1977 Phase 2 same-day rerun stays idempotent", async () => {
  const api = githubIssueFixture({ issues: [{ number: 900, title: "[OSS RADAR] September 2026", created_at: "2026-09-01T00:00:00Z" }], comments: { 900: [] } });
  const args = { repository: "BryanHarrisScripts/PlotPickle", auth: "fixture-auth", contract, discoveryResult: { candidates: fixture.candidates }, fetchImpl: api.fetchImpl, now: reportDate };
  const first = await publishDailyRadar(args);
  const second = await publishDailyRadar(args);
  assert.equal(first.action, "created");
  assert.equal(second.action, "updated");
  assert.equal(api.state.issues.length, 1);
  assert.equal(api.state.comments.get(900).length, 1);
  assert.equal(parseDailyState(api.state.comments.get(900)[0].body).entries.length, 5);
});

test("#1977 Phase 2 month rollover carries prior history", async () => {
  const priorBody = dailyComment("2026-09-30", [fixture.candidates[0]]);
  const api = githubIssueFixture({ issues: [{ number: 901, title: "[OSS RADAR] September 2026", created_at: "2026-09-01T00:00:00Z" }], comments: { 901: [{ id: 4999, body: priorBody }] } });
  const result = await publishDailyRadar({ repository: "BryanHarrisScripts/PlotPickle", auth: "fixture-auth", contract, discoveryResult: { candidates: fixture.candidates }, fetchImpl: api.fetchImpl, now: new Date("2026-10-01T12:00:00Z") });
  assert.equal(result.monthlyIssueTitle, "[OSS RADAR] October 2026");
  assert.equal(api.state.issues.length, 2);
  assert.equal(result.suppressed.history, 1);
});

test("#1977 Phase 2 API failures remain explicit and writes stay bounded", async () => {
  const failing = githubIssueFixture({ failSearch: true });
  await assert.rejects(publishDailyRadar({ repository: "BryanHarrisScripts/PlotPickle", auth: "fixture-auth", contract, discoveryResult: { candidates: fixture.candidates }, fetchImpl: failing.fetchImpl, now: reportDate }), /HTTP 500: fixture search failure/u);
  const api = githubIssueFixture({ issues: [], comments: {} });
  await publishDailyRadar({ repository: "BryanHarrisScripts/PlotPickle", auth: "fixture-auth", contract, discoveryResult: { candidates: fixture.candidates }, fetchImpl: api.fetchImpl, now: reportDate });
  assert.ok(api.state.calls.every((call) => call.pathname === "/search/issues" || /^\/repos\/BryanHarrisScripts\/PlotPickle\/issues(?:\/\d+\/comments|\/comments\/\d+)?$/u.test(call.pathname)));
});
