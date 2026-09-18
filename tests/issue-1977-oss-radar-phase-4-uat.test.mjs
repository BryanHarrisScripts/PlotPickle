import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadDiscoveryContract } from "../lib/verification/oss-radar/discover-github.mjs";
import { runRadar } from "../lib/verification/oss-radar/run-radar.mjs";

const contract = await loadDiscoveryContract();
const discoveryFixture = JSON.parse(await readFile("tests/fixtures/oss-radar/phase-1-github-search.json", "utf8"));
const workflow = await readFile(".github/workflows/oss-radar.yml", "utf8");

function fullRadarFixture() {
  const state = { issues: [], comments: new Map(), calls: [], nextIssue: 3000, nextComment: 7000 };
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    state.calls.push({ method, pathname: url.pathname });

    if (url.pathname === "/search/repositories" && method === "GET") {
      const query = url.searchParams.get("q") || "";
      const lane = contract.lanes.find((entry) => entry.queryFamilies.some((family) => family.queries.some((configuredQuery) => query.includes(configuredQuery))));
      assert.ok(lane, `fixture could not resolve Radar lane for ${query}`);
      return { ok: true, status: 200, json: async () => ({ items: discoveryFixture.responses[lane.id] || [] }) };
    }
    const readmeMatch = url.pathname.match(/^\/repos\/[^/]+\/[^/]+\/readme$/u);
    if (readmeMatch && method === "GET") {
      const text = "agent runtime context management human approval story state creative writing";
      return { ok: true, status: 200, json: async () => ({ encoding: "base64", size: Buffer.byteLength(text), content: Buffer.from(text).toString("base64") }) };
    }
    if (/^\/repos\/[^/]+\/[^/]+\/contents\//u.test(url.pathname) && method === "GET") {
      return { ok: false, status: 404, json: async () => ({ message: "fixture manifest missing" }) };
    }
    if (url.pathname === "/search/issues" && method === "GET") {
      return { ok: true, status: 200, json: async () => ({ items: state.issues }) };
    }
    const issueComments = url.pathname.match(/^\/repos\/BryanHarrisScripts\/PlotPickle\/issues\/(\d+)\/comments$/u);
    if (issueComments && method === "GET") {
      return { ok: true, status: 200, json: async () => state.comments.get(Number(issueComments[1])) || [] };
    }
    if (issueComments && method === "POST") {
      const issueNumber = Number(issueComments[1]);
      const comment = { id: state.nextComment++, body: body.body };
      state.comments.set(issueNumber, [...(state.comments.get(issueNumber) || []), comment]);
      return { ok: true, status: 201, json: async () => comment };
    }
    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle/issues" && method === "POST") {
      const issue = { number: state.nextIssue++, title: body.title, body: body.body, created_at: "2026-09-13T11:00:00Z" };
      state.issues.unshift(issue);
      state.comments.set(issue.number, []);
      return { ok: true, status: 201, json: async () => issue };
    }
    const commentUpdate = url.pathname.match(/^\/repos\/BryanHarrisScripts\/PlotPickle\/issues\/comments\/(\d+)$/u);
    if (commentUpdate && method === "PATCH") {
      const id = Number(commentUpdate[1]);
      for (const [issueNumber, list] of state.comments) {
        const index = list.findIndex((comment) => comment.id === id);
        if (index >= 0) {
          const updated = { ...list[index], body: body.body };
          list[index] = updated;
          state.comments.set(issueNumber, list);
          return { ok: true, status: 200, json: async () => updated };
        }
      }
    }
    throw new Error(`Unexpected Phase 4 UAT request ${method} ${url.pathname}`);
  };
  return { state, fetchImpl };
}

test("#1977 Phase 4 workflow is daily, manually dispatchable and least-privilege", () => {
  assert.match(workflow, /schedule:\n\s+- cron: '24 4 \* \* \*'\n\s+timezone: 'America\/Toronto'/u);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /permissions:\n\s+contents: read\n\s+issues: write/u);
  assert.doesNotMatch(workflow, /^\s*push:/mu);
  assert.doesNotMatch(workflow, /^\s*pull_request:/mu);
  assert.match(workflow, /group: plotpickle-oss-radar/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(workflow, /timeout-minutes: 10/u);
  assert.match(workflow, /node --test tests\/issue-1977-oss-radar-\*\.test\.mjs tests\/issue-2034-oss-radar-\*\.test\.mjs/u);
  assert.match(workflow, /node lib\/verification\/oss-radar\/run-radar\.mjs/u);
  assert.match(workflow, /github\.token/u);
});

test("#1977 Phase 4 full UAT keeps one monthly thread and the adaptive architecture review queue", async () => {
  const api = fullRadarFixture();
  const base = { repository: "BryanHarrisScripts/PlotPickle", auth: "fixture-auth", fetchImpl: api.fetchImpl };

  const first = await runRadar({ ...base, now: new Date("2026-09-13T11:00:00Z") });
  assert.equal(first.action, "created");
  assert.equal(first.monthlyIssueTitle, "[OSS RADAR] September 2026");
  assert.ok(first.reviewCount > 0 && first.reviewCount <= contract.report.targetFindings);
  assert.ok(first.reviewCount <= Math.min(contract.report.targetFindings, first.state.candidates.length));
  assert.equal(api.state.issues.length, 1);
  assert.equal(api.state.comments.get(first.monthlyIssueNumber).length, 1);
  assert.match(first.reportBody, /GitHub discovery/u);
  assert.match(first.reportBody, /Raw repository pointers returned/u);
  assert.match(first.reportBody, /Repository creation age/u);
  assert.match(first.reportBody, /Radar candidate history/u);
  assert.match(first.reportBody, /Architecture findings for review/u);
  assert.match(first.reportBody, /Seven PlotPickle Architecture Areas/u);
  assert.match(first.reportBody, /bounded read-only enrichment/u);
  assert.match(first.reportBody, /Discovery coverage/u);
  assert.match(first.reportBody, /Query effectiveness/u);
  assert.ok(first.state.candidates.length >= first.reviewCount);

  const rerun = await runRadar({ ...base, now: new Date("2026-09-13T11:00:00Z") });
  assert.equal(rerun.action, "updated");
  assert.equal(rerun.commentId, first.commentId);
  assert.equal(api.state.issues.length, 1);
  assert.equal(api.state.comments.get(first.monthlyIssueNumber).length, 1);
  assert.deepEqual(rerun.state.candidates.map((entry) => entry.firstSeenDate), first.state.candidates.map((entry) => entry.firstSeenDate));

  const nextDay = await runRadar({ ...base, now: new Date("2026-09-14T11:00:00Z") });
  assert.equal(nextDay.action, "created");
  assert.equal(api.state.comments.get(first.monthlyIssueNumber).length, 2);
  assert.equal(nextDay.reviewCount, 0);
  assert.match(nextDay.reportBody, /Previously reviewed unchanged candidates suppressed:\*\* [1-9]/u);
  assert.match(nextDay.reportBody, /Seen by Radar yesterday:\*\* [1-9]/u);

  assert.ok(api.state.calls.every(({ pathname }) =>
    pathname === "/search/repositories"
    || /^\/repos\/[^/]+\/[^/]+\/readme$/u.test(pathname)
    || /^\/repos\/[^/]+\/[^/]+\/contents\//u.test(pathname)
    || pathname === "/search/issues"
    || pathname === "/repos/BryanHarrisScripts/PlotPickle/issues"
    || /^\/repos\/BryanHarrisScripts\/PlotPickle\/issues\/\d+\/comments$/u.test(pathname)
    || /^\/repos\/BryanHarrisScripts\/PlotPickle\/issues\/comments\/\d+$/u.test(pathname)
  ));
});
