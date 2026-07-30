import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #210 defines a dormant PlotPickle-managed Buzz runtime", async () => {
  const runtime = await source("lib/buzz-runtime.ts");

  for (const component of ["buzz-relay", "buzz-cli", "buzz-agent", "buzz-dev-mcp"]) {
    assert.match(runtime, new RegExp(`"${component}"`));
  }

  for (const platform of ["windows-x64", "macos-x64", "macos-arm64", "linux-x64"]) {
    assert.match(runtime, new RegExp(`"${platform}"`));
  }

  assert.match(runtime, /lifecycle: "unconfigured"/);
  assert.match(runtime, /configured: false/);
  assert.match(runtime, /packaged: false/);
  assert.match(runtime, /processRunning: false/);
  assert.match(runtime, /relayListening: false/);
  assert.match(runtime, /identityCreated: false/);
  assert.match(runtime, /dataCreated: false/);
  assert.match(runtime, /paths: null/);
  assert.match(runtime, /An unconfigured runtime creates no process, listening port, identity, credential or Buzz project data/);
});

test("issue #210 keeps Settings, PPF and GitHub authority boundaries explicit", async () => {
  const [runtime, brief] = await Promise.all([
    source("lib/buzz-runtime.ts"),
    source("docs/issue-210-managed-buzz-runtime.md"),
  ]);

  assert.match(runtime, /Settings → Integrations → Buzz/);
  assert.match(runtime, /PPF remains the canonical creative record/);
  assert.match(runtime, /GitHub remains the canonical code repository and pull-request authority/);
  assert.match(runtime, /private keys and service secrets never enter PPF projects/);

  assert.match(brief, /Reports \| Collab · Buzz \| Settings/);
  assert.match(brief, /Collab.*Story Proposals/s);
  assert.match(brief, /Buzz.*rooms, conversations, agents/s);
  assert.match(brief, /Feedback.*permanent structured review/s);
});

test("issue #210 does not pretend native Buzz binaries are already packaged", async () => {
  const [runtime, packagingReadme, entries] = await Promise.all([
    source("lib/buzz-runtime.ts"),
    source("runtime/buzz/README.md"),
    readdir(new URL("runtime/buzz", root), { withFileTypes: true }),
  ]);

  assert.match(runtime, /packaged: false/);
  assert.match(packagingReadme, /No Buzz executable is committed by the Phase 1 architecture work/);
  assert.match(packagingReadme, /checksummed and clean-machine tested/);
  assert.deepEqual(entries.map((entry) => entry.name).sort(), ["README.md"]);
});

test("issue #210 locks coding agents behind isolated worktrees and human-controlled publishing", async () => {
  const brief = await source("docs/issue-210-managed-buzz-runtime.md");

  assert.match(brief, /explicit Developer Mode/);
  assert.match(brief, /isolated worktree/);
  assert.match(brief, /cannot read the PlotPickle credential vault/);
  assert.match(brief, /Changes are branch-only/);
  assert.match(brief, /Tests run before publishing/);
  assert.match(brief, /Collab remains the human approval and merge surface/);
});
