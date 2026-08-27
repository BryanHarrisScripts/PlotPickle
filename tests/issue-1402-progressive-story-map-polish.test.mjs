import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #1402 matches the approved 12-sequence shift and marker language", async () => {
  const board = await source("modules/build/ui/progressive-story-map.tsx");
  for (const contract of [
    "SEQUENCE_SHIFT_OPTIONS",
    'id: "fear-courage", from: "Fear", to: "Courage"',
    'id: "ignorance-awareness", from: "Ignorance", to: "Awareness"',
    'id: "isolation-alliance", from: "Isolation", to: "Alliance"',
    'id: "certainty-doubt", from: "Certainty", to: "Doubt"',
    'id: "strength-weakness", from: "Strength", to: "Weakness"',
    'id: "control-chaos", from: "Control", to: "Chaos"',
    'id: "conflict-resolution", from: "Conflict", to: "Resolution"',
    'id: "victory-defeat", from: "Victory", to: "Defeat"',
    'id: "guilt-redemption", from: "Guilt", to: "Redemption"',
    'id: "setback-triumph", from: "Setback", to: "Triumph"',
    'id: "despair-hope", from: "Despair", to: "Hope"',
    'id: "old-self-new-self", from: "Old Self", to: "New Self"',
    '3: { badge: "A1 TP"',
    '6: { badge: "A2 TP"',
    '9: { badge: "A3 TP"',
    '12: { badge: "FINALE"',
  ]) assert.ok(board.includes(contract), `Approved #1402 board contract is missing: ${contract}`);
});

test("issue #1402 renders light-only card states and keeps the five-state legend below the board", async () => {
  const board = await source("modules/build/ui/progressive-story-map.tsx");
  for (const contract of [
    "statusLine",
    "statusDot",
    "miniStep",
    'aria-label={`Status: ${STATE_LABELS[block.state]}',
    'aria-label={`Mini-Block ${mini.number}, ${mini.label}: ${STATE_LABELS[mini.state]}`}',
    'aria-haspopup="listbox"',
    'role="option"',
    "Not enough information yet",
  ]) assert.ok(board.includes(contract), `Accessible #1402 status contract is missing: ${contract}`);

  for (const label of ["DEFINED", "OBSERVED", "EMERGING", "MISSING", "LOCKED"]) {
    assert.ok(board.includes(label), `The standardized five-state label ${label} is missing.`);
  }
  assert.doesNotMatch(board, /<strong>\{STATE_LABELS\[block\.state\]\}<\/strong>/,
    "Living story cards must show only the colour light, not repeat the state word.");
  assert.doesNotMatch(board, /className=\{styles\.lockIcon\}/,
    "Living story states must use one consistent circle-light treatment, including LOCKED.");

  const mapIndex = board.indexOf('className={styles.map}');
  const legendIndex = board.indexOf('className={styles.legend}');
  assert.ok(mapIndex >= 0 && legendIndex > mapIndex, "The five-state legend must appear below the 24-card board.");
});

test("issue #1402 uses five distinct saturated state colours without making Missing a disabled state", async () => {
  const css = await source("modules/build/ui/progressive-story-map.module.css");
  for (const contract of [
    "--story-defined: #35d779;",
    "--story-observed: #3bb8ff;",
    "--story-emerging: #f6a93b;",
    "--story-missing: #ff4d6d;",
    "--story-locked: #a875ff;",
    "--story-orange: #ff922f;",
    "--story-teal: #47d7ca;",
    ".statusDot",
    ".miniStep",
    ".legendDot",
    ".shiftMenu",
  ]) assert.ok(css.includes(contract), `Approved #1402 styling contract is missing: ${contract}`);
  for (const forbidden of ["--story-observed: #aab4b0;", "--story-locked: #66706c;", "--story-observed: #ffffff;", "--story-locked: #ffffff;"]) {
    assert.ok(!css.includes(forbidden), `Status palette must not use neutral white/grey: ${forbidden}`);
  }
  assert.doesNotMatch(css, /\.block\[data-state=["']missing["']\][^{]*\{[^}]*pointer-events\s*:\s*none/s);
});

test("issue #1402 persists sequence shift IDs through the existing Foundations project command path", async () => {
  const [plan, command, apply] = await Promise.all([
    source("core/contracts/foundation-plan.ts"),
    source("core/contracts/story-command.ts"),
    source("core/project/apply-command.ts"),
  ]);
  assert.match(plan, /FOUNDATION_SEQUENCE_SHIFT_METADATA_ID = "__story-map-sequence-shifts__"/);
  assert.match(command, /readonly type: "foundations\.sequence-shift\.update"/);
  assert.match(command, /readonly sequenceId: string/);
  assert.match(command, /readonly shiftId: string/);
  assert.match(apply, /case "foundations\.sequence-shift\.update"/);
  assert.match(apply, /\[FOUNDATION_SEQUENCE_SHIFT_METADATA_ID\]/);
  assert.match(apply, /\[command\.sequenceId\]: command\.shiftId/);

  const shiftCase = apply.slice(
    apply.indexOf('case "foundations.sequence-shift.update"'),
    apply.indexOf('case "foundations.proposal.store"'),
  );
  assert.doesNotMatch(shiftCase, /activeLessonId\s*:/, "Changing a visual sequence shift must not move the writer to a different PLAN lesson.");
});
