import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assessDsddInterpretation,
  assertDsddInterpretationIntegrity,
} from "../build/dsdd/dsdd-intent-integrity.mjs";
import {
  assessPiDraftGrounding,
  extractPiRepositoryPathClaims,
} from "../scripts/dsdd-pi-grounding.mjs";

const LEARN_HUMAN = "The first thing that I talked about earlier was when you go into learn. And so from explore to number one, learn the first screen should be just the explore all and the actual screen. should be the all curriculum topics, 96 presentation lessons. That's the first thing. The other menus aren't required. Yeah, everything else is here.";

const DASHBOARD_HUMAN = "Test, test, test. Okay, so the first thing that I'd like to do is move story under discover. I know what a rename discover mind map. So the mind map story right at it. Thank you. Thank you. In the political menu change discover to mind map.";

test("#2371 blocks the real #2366 pathological Learn interpretation before lock", () => {
  const repeated = Array.from({ length: 30 }, () => "I'm going to go ahead and say it's not a problem.").join(" ");
  const result = assessDsddInterpretation({ humanStatement: LEARN_HUMAN, interpretation: repeated });
  assert.equal(result.ok, false);
  assert.match(result.code, /pathological-repetition|unjustified-no-action/u);
  assert.throws(
    () => assertDsddInterpretationIntegrity({ humanStatement: LEARN_HUMAN, interpretation: repeated }),
    /cannot be locked|did not/u,
  );
});

test("#2371 blocks the real #2367 unrelated no-action interpretation", () => {
  const result = assessDsddInterpretation({
    humanStatement: DASHBOARD_HUMAN,
    interpretation: "I'm going to go ahead and say it's not a problem. I'm going to go ahead.",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "unjustified-no-action");
});

test("#2371 preserves explicit valid no-action observations", () => {
  const result = assessDsddInterpretation({
    humanStatement: "I checked this again and this is not a problem. It is working as expected.",
    interpretation: "Understood. This is not a problem and no development action is required. I'll retain it as a UAT observation.",
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, "valid-no-action");
});

test("#2371 accepts concise interpretations that retain material Human terms", () => {
  const result = assessDsddInterpretation({
    humanStatement: DASHBOARD_HUMAN,
    interpretation: "- Rename Discover to Mind Map in Dashboard navigation.\n- Keep Story associated with that Mind Map destination.\n- Verify the Dashboard navigation after the change.",
  });
  assert.equal(result.ok, true);
  assert.ok(result.sharedTerms.includes("discover"));
});

test("#2371 rejects the exact invented Pi path shape from #2367", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-dsdd-grounding-"));
  try {
    await mkdir(path.join(root, "config"), { recursive: true });
    await writeFile(path.join(root, "config", "real-menu.json"), "{}\n", "utf8");
    const markdown = [
      "# Pi Technical Developer Draft",
      "Inspect `config/real-menu.json`.",
      "Likely change `src/config/menus.ts`.",
      "Test `src/tests/config/menus.test.ts`.",
    ].join("\n");

    assert.deepEqual(extractPiRepositoryPathClaims(markdown), [
      "config/real-menu.json",
      "src/config/menus.ts",
      "src/tests/config/menus.test.ts",
    ]);
    const result = assessPiDraftGrounding(markdown, root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.grounded, ["config/real-menu.json"]);
    assert.deepEqual(result.missing, ["src/config/menus.ts", "src/tests/config/menus.test.ts"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#2371 gateway rechecks integrity at append, lock and publish boundaries", async () => {
  const { readFile } = await import("node:fs/promises");
  const gateway = await readFile(new URL("../build/dsdd/dsdd-session-gateway.ts", import.meta.url), "utf8");
  const draft = await readFile(new URL("../scripts/dsdd-pi-draft.mjs", import.meta.url), "utf8");

  assert.ok(gateway.match(/assertDsddInterpretationIntegrity/g)?.length >= 3);
  assert.match(draft, /assertPiDraftGrounding\(text, repoRoot\)/u);
  assert.match(draft, /Unknown \/ requires inspection/u);
});
