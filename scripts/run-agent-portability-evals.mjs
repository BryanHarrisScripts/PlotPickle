#!/usr/bin/env node

const cases = [
  {
    id: "sage-grounded-answer",
    profileId: "sage-brinewick",
    capabilityRole: "quality",
    description: "Sage answers from current curriculum and cites bounded source IDs.",
    evaluate(output) {
      const failures = [];
      if (output?.grounded !== true) failures.push("answer is not marked curriculum-grounded");
      if (!Array.isArray(output?.sourceIds) || output.sourceIds.length === 0) failures.push("no curriculum source IDs were supplied");
      if (typeof output?.answer !== "string" || output.answer.trim().split(/\s+/).length < 8) failures.push("answer is too thin to demonstrate useful teaching");
      return failures;
    },
  },
  {
    id: "plan-bounded-proposal",
    profileId: "tamsin-briarlock",
    capabilityRole: "quality",
    description: "PLAN returns a bounded proposal without claiming canon authority.",
    evaluate(output) {
      const failures = [];
      if (output?.proposalOnly !== true) failures.push("PLAN output is not proposal-only");
      if (!output?.fields || typeof output.fields !== "object" || Array.isArray(output.fields)) failures.push("PLAN fields are missing");
      if (!Array.isArray(output?.evidenceRefs) || output.evidenceRefs.length === 0) failures.push("PLAN output has no evidence references");
      if (output?.canonical === true) failures.push("PLAN output incorrectly claims canonical authority");
      return failures;
    },
  },
  {
    id: "graph-structured-node",
    profileId: "bram-gatewick",
    capabilityRole: "fast",
    description: "A graph worker honors the structured node contract.",
    evaluate(output) {
      const failures = [];
      const allowed = new Set(["id", "severity", "summary", "evidenceRefs"]);
      if (!output || typeof output !== "object" || Array.isArray(output)) return ["graph output is not an object"];
      if (Object.keys(output).some((key) => !allowed.has(key))) failures.push("graph output contains undeclared fields");
      if (typeof output.id !== "string" || !output.id) failures.push("graph finding ID is missing");
      if (!["low", "medium", "high"].includes(output.severity)) failures.push("graph severity is invalid");
      if (!Array.isArray(output.evidenceRefs) || output.evidenceRefs.length === 0) failures.push("graph output has no evidence");
      return failures;
    },
  },
  {
    id: "fresh-verifier-rejects-known-bad",
    profileId: "bram-gatewick",
    capabilityRole: "quality",
    description: "A fresh verifier rejects a known-bad finding instead of trusting the worker.",
    evaluate(output) {
      const failures = [];
      if (output?.workerSelfAssessmentAuthority !== "none") failures.push("worker self-assessment was given authority");
      if (output?.real !== false) failures.push("known-bad finding was not rejected");
      if (!Array.isArray(output?.evidenceRefs) || output.evidenceRefs.length === 0) failures.push("verifier did not cite evidence");
      return failures;
    },
  },
];

const fixtureCandidates = [
  {
    provider: "fixture-local",
    runtime: "openai-compatible",
    model: "quality-a",
    outputs: {
      "sage-grounded-answer": { grounded: true, sourceIds: ["learn:foundations:stakes"], answer: "Stakes show what becomes harder or more costly if the protagonist fails." },
      "plan-bounded-proposal": { proposalOnly: true, canonical: false, fields: { protagonistWant: "Get home", stakes: "Lose the family farm" }, evidenceRefs: ["ppf:foundations"] },
      "graph-structured-node": { id: "finding-1", severity: "high", summary: "Known fixture issue", evidenceRefs: ["test:fixture"] },
      "fresh-verifier-rejects-known-bad": { workerSelfAssessmentAuthority: "none", real: false, evidenceRefs: ["test:known-bad"] },
    },
  },
  {
    provider: "fixture-alternate",
    runtime: "alternate-compatible",
    model: "quality-b",
    outputs: {
      "sage-grounded-answer": { grounded: true, sourceIds: ["learn:foundations:stakes"], answer: "The lesson matters because consequences turn a goal into pressure that can drive scene choices." },
      "plan-bounded-proposal": { proposalOnly: true, canonical: false, fields: { protagonistWant: "Protect her sister", stakes: "Expose the secret" }, evidenceRefs: ["context:accepted-project-facts"] },
      "graph-structured-node": { id: "finding-2", severity: "medium", summary: "Alternate fixture issue", evidenceRefs: ["test:alternate"] },
      "fresh-verifier-rejects-known-bad": { workerSelfAssessmentAuthority: "none", real: false, evidenceRefs: ["test:known-bad"] },
    },
  },
];

export function runPortabilityEvals(candidates = fixtureCandidates) {
  const results = [];
  for (const candidate of candidates) {
    for (const item of cases) {
      const failures = item.evaluate(candidate.outputs[item.id]);
      results.push({
        caseId: item.id,
        profileId: item.profileId,
        capabilityRole: item.capabilityRole,
        provider: candidate.provider,
        runtime: candidate.runtime,
        model: candidate.model,
        passed: failures.length === 0,
        failures,
      });
    }
  }
  return results;
}

export function summarizePortabilityEvals(results) {
  const byRoute = new Map();
  for (const result of results) {
    const key = `${result.provider}/${result.runtime}/${result.model}`;
    const current = byRoute.get(key) || { route: key, passed: 0, failed: 0 };
    if (result.passed) current.passed += 1;
    else current.failed += 1;
    byRoute.set(key, current);
  }
  return [...byRoute.values()];
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll("\\", "/"))) {
  const results = runPortabilityEvals();
  const summary = summarizePortabilityEvals(results);
  console.log(JSON.stringify({ ok: results.every((result) => result.passed), results, summary }, null, 2));
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}
