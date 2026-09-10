import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { visualViolations } from "../lib/verification/webmcp-surface-visual-audit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const standard = read("docs/UI-UX-DESIGN-STANDARD.md");
const skin = read("app/skin-v1-definition.css");
const globalTokens = read("app/design-tokens.css");
const audit = read("lib/verification/webmcp-surface-visual-audit.mjs");
const brief = read("docs/developer-briefs/1854-ui-conformance-webmcp.md");
const issue = read("docs/issues/1854-ui-conformance.md");
const reporter = read("scripts/report-uat-findings.mjs");
const agents = read("AGENTS.md");

test("#1854 keeps one layered UI authority instead of creating another Skin engine", () => {
  assert.match(standard, /normative product standard/i);
  assert.match(standard, /design-token schema/i);
  assert.match(globalTokens, /PlotPickle global design tokens/i);
  assert.match(skin, /single source of truth for reusable visual primitives/i);
  assert.match(brief, /UI\/UX-DESIGN-STANDARD\.md/);
  assert.match(brief, /design-tokens\.css/);
  assert.match(brief, /skin-v1-definition\.css/);
  assert.match(brief, /active Skin V1 presentation mapping/i);
  assert.match(issue, /No new Skin engine/i);
  assert.doesNotMatch(brief, /switch_skin_surface/);
});

test("#1854 WebMCP inventories governed rendered elements and emits exact bounded violations", () => {
  assert.match(audit, /inventoryGovernedElements/);
  assert.match(audit, /semanticRole/);
  assert.match(audit, /stableIdentity/);
  assert.match(audit, /computedPresentation/);
  assert.match(audit, /visualViolations/);
  assert.match(audit, /property/);
  assert.match(audit, /actual/);
  assert.match(audit, /expected/);
  assert.match(audit, /source/);
  assert.match(audit, /--pp-skin-font-ui/);
  assert.match(audit, /--pp-skin-radius/);
  assert.match(audit, /--pp-skin-control-height/);
  assert.match(audit, /data-skin-role/);
  assert.match(audit, /data-skin-control-kind/);
  assert.doesNotMatch(audit, /textContent:\s*node\.textContent/);
});

test("#1854 reports exact font, shape and control-height drift without copying UI text", () => {
  const contract = {
    surface: "SETTINGS",
    home: { fontFamily: '"Courier New", monospace' },
    tokens: {
      "--pp-skin-radius": "0px",
      "--pp-skin-control-height": "34px",
    },
    inventory: [
      {
        semanticRole: "pill",
        stableIdentity: "agent-provider-openai",
        computedPresentation: {
          tag: "button",
          inputType: "",
          fontFamily: "Arial",
          borderRadius: "6px",
          height: "28px",
        },
      },
    ],
  };
  const violations = visualViolations(contract, contract.tokens);
  assert.deepEqual(violations.map(({ property, actual, expected, source }) => ({ property, actual, expected, source })), [
    { property: "borderRadius", actual: "6px", expected: "0px", source: "--pp-skin-radius" },
    { property: "fontFamily", actual: "Arial", expected: '"Courier New", monospace', source: "--pp-skin-font-ui" },
    { property: "height", actual: "28px", expected: ">= 34px", source: "--pp-skin-control-height" },
  ]);
  assert.equal(JSON.stringify(violations).includes("OpenAI"), false);
});

test("#1854 keeps screenshot baselines complementary and repair/report authority unchanged", () => {
  assert.match(audit, /captureSurfaceCandidate/);
  assert.match(audit, /compareLockedBaseline/);
  assert.match(brief, /Screenshot baseline/i);
  assert.match(brief, /report-uat-findings\.mjs/);
  assert.match(reporter, /gh\("issue", "create"/);
  assert.match(agents, /supported developer-agent candidates are Pi and Cline/i);
  assert.match(agents, /they do not become authority boundaries/i);
  assert.match(brief, /bounded external developer workers/i);
});
