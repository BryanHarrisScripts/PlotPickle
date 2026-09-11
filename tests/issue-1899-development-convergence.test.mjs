import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { evaluateDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

async function withFixture(run) {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "plotpickle-convergence-"));
  try {
    await mkdir(path.join(fixture, "docs"), { recursive: true });
    await mkdir(path.join(fixture, "tests"), { recursive: true });
    await writeFile(path.join(fixture, "docs", "brief.md"), "# Brief\nAcceptance Alpha\n", "utf8");
    await writeFile(path.join(fixture, "tests", "alpha.test.mjs"), "test('alpha contract', () => {});\n", "utf8");
    await run(fixture);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    issue: 9999,
    brief: "docs/brief.md",
    allowedChanges: ["docs/", "tests/"],
    acceptance: [
      {
        id: "A1",
        criterion: "Alpha is covered",
        evidence: [
          { type: "file-contains", path: "docs/brief.md", contains: "Acceptance Alpha" },
          { type: "file-contains", path: "tests/alpha.test.mjs", contains: "alpha contract" },
        ],
      },
    ],
    ...overrides,
  };
}

test("#1899 complete acceptance evidence and scoped changes converge", async () => {
  await withFixture(async (fixture) => {
    const report = await evaluateDevelopmentConvergence({
      manifest: manifest(),
      manifestPath: "config/development-convergence/9999.json",
      root: fixture,
      changedFiles: ["docs/brief.md", "tests/alpha.test.mjs"],
    });
    assert.equal(report.status, "CONVERGED");
    assert.deepEqual(report.remaining, []);
    assert.equal(report.criteria[0].passed, true);
  });
});

test("#1899 missing or stale evidence fails closed", async () => {
  await withFixture(async (fixture) => {
    const report = await evaluateDevelopmentConvergence({
      manifest: manifest({
        acceptance: [{
          id: "A1",
          criterion: "Missing evidence is not complete",
          evidence: [{ type: "file-contains", path: "docs/brief.md", contains: "not present" }],
        }],
      }),
      root: fixture,
      changedFiles: ["docs/brief.md"],
    });
    assert.equal(report.status, "NOT_CONVERGED");
    assert.match(report.remaining.join("\n"), /A1 lacks valid evidence/u);
    assert.equal(report.criteria[0].evidence[0].passed, false);
  });
});

test("#1899 unrelated changed files fail convergence", async () => {
  await withFixture(async (fixture) => {
    const report = await evaluateDevelopmentConvergence({
      manifest: manifest(),
      root: fixture,
      changedFiles: ["docs/brief.md", "tests/alpha.test.mjs", "app/unrelated.tsx"],
    });
    assert.equal(report.status, "NOT_CONVERGED");
    assert.deepEqual(report.unrelatedFiles, ["app/unrelated.tsx"]);
    assert.match(report.remaining.join("\n"), /Unrelated changed file/u);
  });
});

test("#1899 unsupported evidence types fail closed instead of executing arbitrary commands", async () => {
  await withFixture(async (fixture) => {
    const report = await evaluateDevelopmentConvergence({
      manifest: manifest({
        acceptance: [{
          id: "A1",
          criterion: "No arbitrary command evidence",
          evidence: [{ type: "command", path: "docs/brief.md", command: "echo nope" }],
        }],
      }),
      root: fixture,
      changedFiles: ["docs/brief.md"],
    });
    assert.equal(report.status, "NOT_CONVERGED");
    assert.match(report.criteria[0].evidence[0].reason, /Unsupported evidence type/u);
  });
});

test("#1899 repository contract defines the native loop, independent CI convergence and Spec Kit reference boundary", async () => {
  const [architecture, brief, agents, workflow, registry, readme] = await Promise.all([
    read("docs/architecture/PLOTPICKLE-DEVELOPMENT-LOOP.md"),
    read("docs/developer-briefs/1899-plotpickle-development-loop.md"),
    read("AGENTS.md"),
    read(".github/workflows/pr-gate.yml"),
    read("config/third-party-oss.json"),
    read("README.md"),
  ]);

  assert.match(architecture, /IDEA[\s\S]*ASSESS[\s\S]*DEVELOPER BRIEF[\s\S]*ISSUE[\s\S]*PLAN[\s\S]*BUILD[\s\S]*TEST \/ FIX[\s\S]*CONVERGE[\s\S]*PR GATES[\s\S]*MERGE/u);
  assert.match(architecture, /PLOTPICKLE:OSS-INFLUENCE:github-spec-kit/u);
  assert.match(architecture, /GitHub CI reruns the convergence evaluator/u);
  assert.match(architecture, /does \*\*not\*\* install or initialize Spec Kit/u);
  assert.match(brief, /CONVERGED \| NOT_CONVERGED/u);

  assert.match(agents, /PlotPickle Development Loop/u);
  assert.match(agents, /run-development-convergence\.mjs/u);
  assert.match(agents, /non-trivial/u);

  assert.match(workflow, /Validate development convergence/u);
  assert.match(workflow, /node scripts\/run-development-convergence\.mjs --changed/u);
  assert.match(workflow, /issue-1899-development-convergence\.test\.mjs/u);

  assert.match(registry, /"id": "github-spec-kit"/u);
  assert.match(registry, /"usage": "reference-only"/u);
  assert.match(registry, /"license": "MIT"/u);
  assert.match(registry, /PLOTPICKLE-DEVELOPMENT-LOOP\.md/u);
  assert.match(readme, /GitHub Spec Kit/u);
  assert.match(readme, /spec-driven development discipline/u);
});
