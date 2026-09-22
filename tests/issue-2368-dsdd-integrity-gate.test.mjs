import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  dsddNoActionInterpretation,
  evaluateDsddInterpretationIntegrity,
  requirementTextsFromInterpretation,
  validateDsddRequirements,
} from "../build/dsdd/dsdd-intent-integrity.mjs";
import { validateDsddPiGrounding } from "../scripts/dsdd-pi-grounding.mjs";
import { parsePiJsonReadOnlyEvents } from "../scripts/pi-worker-runtime.mjs";

const LEARN_HUMAN = "The first thing that I talked about earlier was when you go into learn. And so from explore to number one, learn the first screen should be just the explore all and the actual screen should be the all curriculum topics, 96 presentation lessons. That's the first thing. The other menus aren't required. Yeah, everything else is here.";
const REPEATED_NOT_A_PROBLEM = "I'm going to go ahead and say it's not a problem. ".repeat(90);

test("#2368 rejects the real #2366 repeated Learn interpretation before intent lock", () => {
  const result = evaluateDsddInterpretationIntegrity({
    humanStatement: LEARN_HUMAN,
    interpretation: REPEATED_NOT_A_PROBLEM,
  });
  assert.equal(result.state, "invalid");
  assert.ok(result.reasons.includes("pathological-repetition"));
  assert.ok(result.reasons.includes("no-action-conflicts-with-human-change-request"));
});

test("#2368 rejects the real #2367 no-action interpretation when the Human asked for Dashboard changes", () => {
  const result = evaluateDsddInterpretationIntegrity({
    humanStatement: "Test. Move Story under Discover, rename Discover to Mind Map, and change the Dashboard menu.",
    interpretation: "I'm going to go ahead and say it's not a problem. I'm going to go ahead.",
  });
  assert.equal(result.state, "invalid");
  assert.ok(result.reasons.includes("no-action-conflicts-with-human-change-request"));
  assert.ok(result.reasons.includes("human-meaning-anchors-missing"));
});

test("#2368 still accepts a concise meaning-preserving product interpretation and bounded requirements", () => {
  const human = "Move Story under Discover and rename Discover to Mind Map on the Dashboard.";
  const interpretation = [
    "- Dashboard navigation should rename Discover to Mind Map.",
    "- Move Story under Mind Map while preserving the other Dashboard destinations.",
  ].join("\n");
  const integrity = evaluateDsddInterpretationIntegrity({ humanStatement: human, interpretation });
  assert.equal(integrity.state, "valid");
  const requirements = requirementTextsFromInterpretation(interpretation);
  assert.deepEqual(requirements, [
    "Dashboard navigation should rename Discover to Mind Map.",
    "Move Story under Mind Map while preserving the other Dashboard destinations.",
  ]);
  assert.equal(validateDsddRequirements({ humanStatement: human, requirements }).state, "valid");
});

test("#2368 preserves explicit no-development-action observations", () => {
  const human = "I tested the screen again. This is not a problem and no change is needed.";
  const interpretation = "Understood. This is not a problem and no development action is required. I’ll retain it as a UAT observation.";
  assert.equal(evaluateDsddInterpretationIntegrity({ humanStatement: human, interpretation }).state, "valid");
  assert.equal(dsddNoActionInterpretation(interpretation), true);
});

test("#2368 parses Pi JSON mode and records actual read-only tool observations", () => {
  const cwd = path.resolve("/repo");
  const output = [
    JSON.stringify({ type: "tool_execution_start", toolCallId: "a", toolName: "read", args: { path: "app/menu.ts" } }),
    JSON.stringify({ type: "tool_execution_end", toolCallId: "a", toolName: "read", result: { content: [{ type: "text", text: "export function updateMenu() {}" }] }, isError: false }),
    JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "# Pi Technical Developer Draft\n## Outcome\nGrounded." }] } }),
  ].join("\n");
  const parsed = parsePiJsonReadOnlyEvents(output, {
    cwd,
    existsSync: (candidate) => candidate === path.resolve(cwd, "app/menu.ts"),
  });
  assert.equal(parsed.text.includes("Pi Technical Developer Draft"), true);
  assert.deepEqual(parsed.observedPaths, ["app/menu.ts"]);
  assert.deepEqual(parsed.toolCalls, [{ toolName: "read", path: "app/menu.ts" }]);
});

test("#2368 rejects Pi paths and symbols that were not observed by read/grep/find/ls", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2368-"));
  try {
    await mkdir(path.join(root, "app"), { recursive: true });
    await writeFile(path.join(root, "app", "menu.ts"), "export function updateMenu() { return true; }\n", "utf8");

    const good = [
      "# Pi Technical Developer Draft",
      "## Likely files and symbols",
      "- Likely change: `app/menu.ts` · `updateMenu`",
      "## Deterministic verification",
      "- Re-run the existing menu contract.",
    ].join("\n");
    const grounded = validateDsddPiGrounding({
      text: good,
      observedPaths: ["app/menu.ts"],
      cwd: root,
    });
    assert.equal(grounded.state, "valid");

    const bad = [
      "# Pi Technical Developer Draft",
      "## Likely files and symbols",
      "- Likely change: `src/config/menus.ts` · `inventedMenu`",
      "## Deterministic verification",
      "- Add `src/tests/config/menus.test.ts`.",
    ].join("\n");
    const rejected = validateDsddPiGrounding({
      text: bad,
      observedPaths: ["app/menu.ts"],
      cwd: root,
    });
    assert.equal(rejected.state, "invalid");
    assert.deepEqual(rejected.ungroundedPaths, ["src/config/menus.ts", "src/tests/config/menus.test.ts"]);
    assert.deepEqual(rejected.ungroundedSymbols, ["inventedMenu"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#2368 source boundaries block invalid interpretation, stale Pi grounding and publication", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const [gateway, panel, draft, runtime] = await Promise.all([
    read("build/dsdd/dsdd-session-gateway.ts"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("scripts/dsdd-pi-draft.mjs"),
    read("scripts/pi-worker-runtime.mjs"),
  ]);
  assert.match(gateway, /interpretation is not safe to lock yet/u);
  assert.match(gateway, /grounding\?\.state !== "valid"/u);
  assert.match(gateway, /Publish Brief is blocked/u);
  assert.match(panel, /interpretationBlocked/u);
  assert.match(panel, /RETRY INTERPRET/u);
  assert.match(draft, /validateDsddPiGrounding/u);
  assert.match(draft, /runPiReadOnlyObserved/u);
  assert.match(runtime, /"--mode", "json"/u);
  assert.match(runtime, /tool_execution_start/u);
  assert.match(runtime, /tool_execution_end/u);
});
