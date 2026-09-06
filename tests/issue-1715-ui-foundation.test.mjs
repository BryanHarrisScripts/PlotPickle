import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  STYLELINT_VERSION,
  findTokenViolations,
  isUiPath
} from "../scripts/ui-stylelint-gate.mjs";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("#1715 Phase 1A pins Stylelint and blocks hardcoded product styling", async () => {
  assert.equal(STYLELINT_VERSION, "17.15.0");

  const config = await source("stylelint.config.mjs");
  assert.match(config, /"color-no-hex": true/);
  assert.match(config, /"function-disallowed-list"/);
  assert.match(config, /app\/design-tokens\.css/);

  const hardcoded = [
    ".bad {",
    "  padding: 12px;",
    "  border-radius: 8px;",
    "  font-size: 14px;",
    "}"
  ].join("\n");
  const violations = findTokenViolations("app/_components/foundation/bad.module.css", hardcoded);
  assert.equal(violations.length, 3);

  const tokenized = [
    ".good {",
    "  padding: var(--pp-space-3);",
    "  border-radius: var(--pp-radius-control);",
    "  font-size: var(--pp-text-sm);",
    "}"
  ].join("\n");
  assert.deepEqual(findTokenViolations("app/_components/foundation/good.module.css", tokenized), []);
});

test("#1715 Phase 1A blocks parallel inline/CSS-in-JS styling in migrated UI", () => {
  assert.equal(isUiPath("app/example.tsx"), true);
  assert.equal(isUiPath("modules/learn/ui/example.tsx"), true);
  assert.equal(isUiPath("lib/story/engine.ts"), false);

  assert.equal(
    findTokenViolations("app/example.tsx", "export function X(){return <div style={{ padding: '1rem' }} />}").length,
    1
  );
  assert.equal(
    findTokenViolations("app/example.tsx", "const panel = css`padding: 1rem`; ").length,
    1
  );
});

test("#1715 Phase 1A keeps the enforcement runner BEN-clean", async () => {
  const runner = await source("scripts/ui-stylelint-gate.mjs");
  assert.doesNotMatch(runner, /function\s+hasDocumentedExemption\s*\(/);
  assert.doesNotMatch(runner, /function\s+argumentValue\s*\(/);
  assert.match(runner, /STYLE_EXEMPTION_PATTERN\.test\(content\)/);
  assert.match(runner, /const baseRefIndex = process\.argv\.indexOf\("--base-ref"\)/);
});

test("#1715 Phase 1C foundation smoke automatically discovers every foundation file", async () => {
  const runner = await source("scripts/ui-stylelint-gate.mjs");
  assert.match(runner, /FOUNDATION_ROOT = "app\/_components\/foundation"/);
  assert.match(runner, /readdir\(FOUNDATION_ROOT, \{ recursive: true \}\)/);
  assert.match(runner, /allFoundation \? await foundationFiles\(\)/);
  assert.doesNotMatch(runner, /FOUNDATION_FILES\s*=\s*\[/);
});

test("#1715 Phase 1A action primitive exposes hierarchy and 44px target semantics", async () => {
  const component = await source("app/_components/foundation/ui-action.tsx");
  const styles = await source("app/_components/foundation/ui-action.module.css");
  const groupStyles = await source("app/_components/foundation/ui-action-group.module.css");

  for (const variant of ["primary", "secondary", "tertiary", "destructive"]) {
    assert.match(component, new RegExp(variant));
  }

  assert.match(component, /data-pp-action=\{variant\}/);
  assert.match(styles, /min-width:\s*var\(--pp-touch-target\)/);
  assert.match(styles, /min-height:\s*var\(--pp-touch-target\)/);
  assert.match(groupStyles, /gap:\s*var\(--pp-space-2\)/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}/i);
});

test("#1715 Phase 1A keeps the merged UI references canonical", async () => {
  const paths = [
    "docs/UI-UX-DESIGN-STANDARD.md",
    "docs/UI-UX-STORY-FOUNDATION.md",
    "docs/UI-UX-STORY-GAME-PRIMITIVES.md"
  ];

  for (const path of paths) {
    const content = await source(path);
    assert.doesNotMatch(content, /issue\/1713-ui-ux-design-standard/);
  }
});

test("#1715 Phase 1A Visual Readiness runs the new foundation gates", async () => {
  const workflow = await source(".github/workflows/visual-readiness.yml");
  assert.match(workflow, /issue-1715-ui-foundation\.test\.mjs/);
  assert.match(workflow, /ui-stylelint-gate\.mjs/);
  assert.match(workflow, /fetch-depth:\s*0/);
});
