import assert from "node:assert/strict";
import test from "node:test";
import { researchOssRules } from "../lib/verification/oss-radar/oss-rules/intelligence.mjs";
import { renderDailyReport } from "../lib/verification/oss-radar/report-renderer.mjs";

function response(value, status = 200) {
  return {
    ok: status === 200,
    status,
    text: async () => typeof value === "string" ? value : JSON.stringify(value),
  };
}

test("#2416 fills OSS Rules intelligence to three pattern observations with OSSRules.md sources", async () => {
  const patterns = {
    "verification-matrix": {
      name: "Verification by change type",
      summary: "Matches each kind of change to the checks that cover it.",
    },
    "skill-routing": {
      name: "Router files",
      summary: "The entry file points each kind of work to a focused guide.",
    },
    "single-source": {
      name: "Pointing at the source of truth",
      summary: "Changing values stay in one authoritative place.",
    },
  };
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname === "/llms.txt") return response("# ossrules.md");
    if (url.pathname === "/api/v1/catalog") return response({ version: 1, links: { projects: "https://ossrules.md/api/v1/projects" } });
    const patternId = url.pathname.match(/^\/api\/v1\/patterns\/([^/]+)$/u)?.[1];
    if (patternId && patterns[patternId]) return response(patterns[patternId]);
    throw new Error(`Unexpected request: ${url.pathname}`);
  };

  const result = await researchOssRules({ candidates: [], fetchImpl });

  assert.equal(result.status, "available");
  assert.equal(result.findings.length, 3);
  assert.deepEqual(result.findings.map((item) => item.patternId), [
    "verification-matrix",
    "skill-routing",
    "single-source",
  ]);
  for (const finding of result.findings) {
    assert.match(finding.ossRulesUrl, /^https:\/\/ossrules\.md\/agent-rules\//u);
    assert.equal(finding.sourceKind, "pattern-library");
  }
});

test("#2416 daily Radar renders three numbered OSS Rules observations with OSSRules.md links", async () => {
  const ossRules = {
    status: "available",
    findings: [
      {
        pattern: "Verification by change type",
        repository: "OSS Rules pattern library",
        area: "Validation & Operations",
        meaning: "Match checks to changes.",
        plotPickleFit: "Compare with PlotPickle verification routing.",
        disposition: "ADAPT",
        ossRulesUrl: "https://ossrules.md/agent-rules/verification-matrix",
        sourceKind: "pattern-library",
      },
      {
        pattern: "Router files",
        repository: "OSS Rules pattern library",
        area: "Agent & Skill Mesh",
        meaning: "Route tasks to focused guidance.",
        plotPickleFit: "Compare with AGENTS.md and the skill registry.",
        disposition: "LEARN",
        ossRulesUrl: "https://ossrules.md/agent-rules/skill-routing",
        sourceKind: "pattern-library",
      },
      {
        pattern: "Pointing at the source of truth",
        repository: "OSS Rules pattern library",
        area: "Experience Contract",
        meaning: "Keep changing values authoritative in one place.",
        plotPickleFit: "Use as a drift check.",
        disposition: "NO ACTION",
        ossRulesUrl: "https://ossrules.md/agent-rules/single-source",
        sourceKind: "pattern-library",
      },
    ],
  };
  const rendered = renderDailyReport({
    reportDate: "2026-09-24",
    selection: { selected: [], belowThreshold: [], reviewQueue: [], target: 0 },
    contract: { runtimeRadar: { discovery: {} } },
    ossRules,
  });

  assert.match(rendered.body, /1\. \*\*Verification by change type\*\*/u);
  assert.match(rendered.body, /2\. \*\*Router files\*\*/u);
  assert.match(rendered.body, /3\. \*\*Pointing at the source of truth\*\*/u);
  assert.match(rendered.body, /\[OSS Rules source\]\(https:\/\/ossrules\.md\/agent-rules\/verification-matrix\)/u);
  assert.match(rendered.body, /\[OSS Rules source\]\(https:\/\/ossrules\.md\/agent-rules\/skill-routing\)/u);
  assert.match(rendered.body, /\[OSS Rules source\]\(https:\/\/ossrules\.md\/agent-rules\/single-source\)/u);
});
