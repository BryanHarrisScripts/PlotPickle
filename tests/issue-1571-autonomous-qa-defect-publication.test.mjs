import assert from "node:assert/strict";
import test from "node:test";
import { publishAutonomousQaDefect } from "../scripts/autonomous-qa/publish-defect.mjs";

const candidate = Object.freeze({
  fingerprint: "qa-defect-0123456789abcdef0123456789abcdef",
  severity: "major",
  testerRole: "full-story-journey",
  routeId: "story-workbench",
  assertionRef: "assertion/workbench-apply",
  expectedRef: "expected/revision-advance",
  actualRef: "actual/stale-rejection",
  errorClass: "revision-conflict",
  reproducible: true,
  observations: [
    { commitSha: "a".repeat(40), buildId: "build/exact-head" },
    { commitSha: "a".repeat(40), buildId: "build/exact-head" },
  ],
  reproductionRefs: ["artifact/reproduction-1", "artifact/reproduction-2"],
  evidenceRefs: ["artifact/campaign-report"],
});

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

test("#1571 reproducible defects create one bounded GitHub issue with exact-build evidence", async () => {
  const calls = [];
  const result = await publishAutonomousQaDefect({
    candidate,
    repository: "BryanHarrisScripts/PlotPickle",
    token: "test-token",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if ((init.method || "GET") === "GET") return response(200, []);
      return response(201, { html_url: "https://github.com/BryanHarrisScripts/PlotPickle/issues/1600" });
    },
  });
  assert.equal(result.disposition, "create-new");
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /issues\?state=open/);
  assert.equal(calls[1].init.method, "POST");
  const body = JSON.parse(calls[1].init.body);
  assert.match(body.body, /plotpickle-autonomous-qa:qa-defect-0123456789abcdef0123456789abcdef/);
  assert.match(body.body, new RegExp("a{40}"));
  assert.match(body.body, /artifact\/reproduction-1/);
  assert.doesNotMatch(body.body, /chain-of-thought|private key|credential/i);
});

test("#1571 matching open fingerprints append evidence instead of creating duplicate issues", async () => {
  const calls = [];
  const result = await publishAutonomousQaDefect({
    candidate,
    repository: "BryanHarrisScripts/PlotPickle",
    token: "test-token",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if ((init.method || "GET") === "GET") {
        return response(200, [{
          number: 1550,
          html_url: "https://github.com/BryanHarrisScripts/PlotPickle/issues/1550",
          body: "<!-- plotpickle-autonomous-qa:qa-defect-0123456789abcdef0123456789abcdef -->",
        }]);
      }
      return response(201, { html_url: "https://github.com/BryanHarrisScripts/PlotPickle/issues/1550#issuecomment-1" });
    },
  });
  assert.equal(result.disposition, "append-existing");
  assert.match(calls[1].url, /issues\/1550\/comments$/);
  assert.equal(calls[1].init.method, "POST");
});

test("#1571 flaky observations are retained without GitHub issue mutation", async () => {
  let called = false;
  const result = await publishAutonomousQaDefect({
    candidate: { ...candidate, reproducible: false, severity: "flaky", observations: [candidate.observations[0]] },
    repository: "BryanHarrisScripts/PlotPickle",
    token: "",
    fetchImpl: async () => { called = true; throw new Error("must not call"); },
  });
  assert.equal(result.disposition, "record-flaky");
  assert.equal(called, false);
});

test("#1571 publisher refuses observations that do not reproduce on the same exact build", async () => {
  await assert.rejects(
    () => publishAutonomousQaDefect({
      candidate: {
        ...candidate,
        observations: [
          candidate.observations[0],
          { commitSha: "b".repeat(40), buildId: "build/other-head" },
        ],
      },
      repository: "BryanHarrisScripts/PlotPickle",
      token: "test-token",
      fetchImpl: async () => response(200, []),
    }),
    /same exact build/,
  );
});

test("#1571 publisher rejects model-invented severity labels", async () => {
  await assert.rejects(
    () => publishAutonomousQaDefect({
      candidate: { ...candidate, severity: "catastrophic" },
      repository: "BryanHarrisScripts/PlotPickle",
      token: "test-token",
      fetchImpl: async () => response(200, []),
    }),
    /severity is invalid/,
  );
});
