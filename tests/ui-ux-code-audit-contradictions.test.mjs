import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../scripts/ui-ux-code-audit.mjs", import.meta.url), "utf8");

test("UI audit recognizes existing image alternative text", () => {
  assert.match(source, /alt\|aria-/);
  assert.match(source, /An img with an explicit alt prop/);
});

test("UI audit rejects preference wording and preserves named navigation landmarks", () => {
  assert.match(source, /unnecessar\(\?:y\|ily\)/);
  assert.match(source, /not\\s\+necessary/);
  assert.match(source, /finding\.criterion === 15 && \/<nav/);
  assert.match(source, /A named nav landmark is correct/);
});

test("UI audit does not invent controls or application roles", () => {
  assert.match(source, /finding\.criterion === 11 && \/<div/);
  assert.match(source, /onClick\|onKeyDown\|onKeyUp\|onPointerDown/);
  assert.match(source, /finding\.criterion === 15 && \/<video/);
  assert.match(source, /Native video controls expose their own accessible interaction model/);
  assert.match(source, /A non-interactive presentation container without an event handler is not a button/);
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
