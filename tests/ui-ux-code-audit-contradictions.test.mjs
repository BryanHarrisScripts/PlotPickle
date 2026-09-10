import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateFindings } from "../scripts/ui-ux-code-audit.mjs";

const source = await readFile(new URL("../scripts/ui-ux-code-audit.mjs", import.meta.url), "utf8");

test("UI audit recognizes existing image alternative text", () => {
  assert.match(source, /alt\|aria-/);
  assert.match(source, /An img with an explicit alt prop/);
});

test("UI audit rejects preference wording and preserves named navigation landmarks", () => {
  assert.match(source, /unnecessar\(\?:y\|ily\)/);
  assert.match(source, /not\\s\+necessary/);
  assert.match(source, /finding\.criterion === 15 && \/<nav/);
  assert.match(source, /invalid\\s\+aria/);
  assert.match(source, /A named nav landmark is correct/);
});

test("UI audit rejects generic ARIA validity claims without a named aria attribute", () => {
  assert.match(source, /function ariaClaimIsUnsubstantiated/);
  assert.match(source, /return !\/\\baria-\[\\w-\]\+\\b\/i\.test\(combined\)/);
  assert.match(source, /An ARIA validity issue must name the exact aria-\* attribute/);
});

test("UI audit does not create nested navigation landmarks for grouping divs", () => {
  assert.match(source, /function evidenceIsInsideNavigationLandmark/);
  assert.match(source, /before\.lastIndexOf\("<nav"\) > before\.lastIndexOf\("<\/nav>"\)/);
  assert.match(source, /A div used only for grouping inside an existing nav is already within the navigation landmark/);
});

test("UI audit does not invent controls or application roles", () => {
  assert.match(source, /finding\.criterion === 11 && \/<div/);
  assert.match(source, /button functionality/);
  assert.match(source, /use\\s\+\(\?:a\\s\+\)\?button/);
  assert.match(source, /onClick\|onKeyDown\|onKeyUp\|onPointerDown/);
  assert.match(source, /finding\.criterion === 15 && \/<video/);
  assert.match(source, /Native video controls expose their own accessible interaction model/);
  assert.match(source, /A non-interactive presentation container without an event handler is not a button/);
  assert.match(source, /A wrapper div around real button descendants remains a non-interactive grouping container/);
});

test("UI audit resolves JSX variable ARIA references", () => {
  assert.match(source, /expressionReference = finding\.evidence\.match/);
  assert.match(source, /id=\\\\\{/);
  assert.match(source, /A JSX aria-labelledby or aria-describedby expression may validly reference/);
});

test("UI audit never calls native headings non-semantic", () => {
  assert.match(source, /finding\.criterion === 11 && \/<h\[1-6\]\\b/);
  assert.match(source, /Native h1, h2, h3, h4, h5, and h6 elements are semantic headings/);
});

test("UI audit does not invent live regions for ordinary React state text", () => {
  assert.match(source, /finding\.criterion === 15 && \/<\(\?:dd\|span\|p\|div\)\\b/);
  assert.match(source, /Ordinary text that changes when React state resolves does not automatically require aria-live or role=status/);
});

test("UI audit rejects vague design-system mismatches and already-defined token claims", () => {
  const file = "app/_components/plotpickle-system/contract.mjs";
  const evidence = 'export const PLOTPICKLE_DESIGN_SYSTEM = "bronze-jade-rune";';
  const vagueMismatch = validateFindings([{
    kind: "issue",
    criterion: 1,
    file,
    message: "Design system constant does not match the expected value.",
    suggestion: "Ensure the design system constant matches the expected design system value.",
    evidence,
  }], new Map([[file, evidence]]), "");
  assert.deepEqual(vagueMismatch, []);

  const cssFile = "app/_components/plotpickle-system/system.css";
  const tokenEvidence = "--pp-system-metal: var(--pp-shell-bronze);";
  const definedToken = validateFindings([{
    kind: "issue",
    criterion: 1,
    file: cssFile,
    message: "Design system token '--pp-system-metal' is not defined.",
    suggestion: "Define '--pp-system-metal' in the design tokens.",
    evidence: tokenEvidence,
  }], new Map([[cssFile, tokenEvidence]]), tokenEvidence);
  assert.deepEqual(definedToken, []);
});
