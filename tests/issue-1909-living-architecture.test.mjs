import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DRIFT_STATUSES,
  UPDATES_END,
  UPDATES_START,
  archiveCurrentUpdate,
  classifyDocumentationEvidence,
  extractManagedBlock,
  fingerprintArchitecture,
  renderAgentContext,
  renderC4,
  renderCurrentUpdate,
  renderHistoryIndex,
  replaceManagedUpdates,
  stableArchiveFilename,
  validateArchiveHistory
} from "../architecture/generate-living-architecture.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const architecture = JSON.parse(read("architecture/plotpickle.architecture.json"));
const fingerprint = fingerprintArchitecture(architecture);

const currentEvidence = [
  { surface: "Architecture Knowledge Map", status: "CURRENT", evidence: "canonical" },
  { surface: "Architecture Documentation", status: "REVIEW", evidence: "human review" },
  { surface: "Generated architecture bundle", status: "CURRENT", evidence: "generated" },
  { surface: "Agent Context", status: "CURRENT", evidence: "generated" },
  { surface: "C4 projections", status: "CURRENT", evidence: "generated" }
];

test("#1909 keeps one canonical Architecture Knowledge Map and one README current UPDATES entry", () => {
  const readme = read("README.md");
  assert.equal((readme.match(/PLOTPICKLE:UPDATES:START/g) ?? []).length, 1);
  assert.equal((readme.match(/PLOTPICKLE:UPDATES:END/g) ?? []).length, 1);
  assert.equal((readme.match(/^## UPDATES$/gm) ?? []).length, 1);
  assert.match(readme, /Architecture Knowledge Map\]\(architecture\/plotpickle\.architecture\.json\)/);
  assert.match(readme, /Architecture Documentation\]\(architecture\/README\.md\)/);
  assert.match(readme, /Documentation Drift Detection\]\(docs\/updates\/documentation-drift\.md\)/);
  assert.match(readme, /Agent Context\]\(docs\/architecture\/agent-context\.md\)/);
  assert.match(readme, /C4 Diagrams\]\(architecture\/plotpickle-c4\.md\)/);
  assert.doesNotMatch(readme, /UPDATES screen|Dashboard UPDATES|Settings UPDATES/);
  assert.equal(architecture.blueprint.source, "architecture/plotpickle.architecture.json");
});

test("#1909 source fingerprint and generated current entry are deterministic", () => {
  assert.equal(fingerprintArchitecture(architecture), fingerprintArchitecture(JSON.parse(JSON.stringify(architecture))));
  const a = renderCurrentUpdate(architecture, fingerprint, currentEvidence);
  const b = renderCurrentUpdate(architecture, fingerprint, currentEvidence);
  assert.equal(a, b);
  assert.ok(a.startsWith(UPDATES_START));
  assert.ok(a.endsWith(UPDATES_END));
  assert.match(a, new RegExp(fingerprint.replace(":", "\\:")));
});

test("#1909 managed UPDATES insertion preserves the existing ARCHITECTURE owner", () => {
  const source = `before\n<!-- PLOTPICKLE:ARCHITECTURE:START -->\narchitecture\n<!-- PLOTPICKLE:ARCHITECTURE:END -->\nafter\n`;
  const section = renderCurrentUpdate(architecture, fingerprint, currentEvidence);
  const next = replaceManagedUpdates(source, section);
  assert.equal((next.match(/PLOTPICKLE:ARCHITECTURE:START/g) ?? []).length, 1);
  assert.equal((next.match(/PLOTPICKLE:UPDATES:START/g) ?? []).length, 1);
  assert.ok(next.indexOf(UPDATES_START) < next.indexOf("PLOTPICKLE:ARCHITECTURE:START"));
  assert.equal(extractManagedBlock(next), section);
  assert.throws(() => extractManagedBlock(`${section}\n${section}`), /UPDATES_MANAGED_BLOCK_CONFLICT/);
});

test("#1909 drift states CURRENT STALE MISSING CONFLICT REVIEW are machine-testable", () => {
  assert.deepEqual(DRIFT_STATUSES, ["CURRENT", "STALE", "MISSING", "CONFLICT", "REVIEW"]);
  const expected = `Source fingerprint: \`${fingerprint}\`\n`;
  assert.equal(classifyDocumentationEvidence({ exists: true, content: expected, expectedContent: expected, expectedFingerprint: fingerprint, requiresFingerprint: true }), "CURRENT");
  assert.equal(classifyDocumentationEvidence({ exists: true, content: expected, expectedContent: `${expected}changed`, expectedFingerprint: fingerprint, requiresFingerprint: true }), "STALE");
  assert.equal(classifyDocumentationEvidence({ exists: false }), "MISSING");
  assert.equal(classifyDocumentationEvidence({ exists: true, content: `${expected}Source fingerprint: \`sha256:${"0".repeat(64)}\``, expectedFingerprint: fingerprint, requiresFingerprint: true }), "CONFLICT");
  assert.equal(classifyDocumentationEvidence({ exists: true, content: expected, expectedFingerprint: fingerprint, semanticReviewRequired: true }), "REVIEW");
});

test("#1909 Agent Context is compact, subordinate to AGENTS.md and derived from the canonical map", () => {
  const context = renderAgentContext(architecture, fingerprint);
  assert.equal(context, read("docs/architecture/agent-context.md"));
  assert.match(context, /AGENTS\.md.*development constitution/);
  assert.match(context, /canonical Architecture Knowledge Map/);
  for (const layer of architecture.layers) assert.match(context, new RegExp(layer.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(context.length < 8000, `Agent Context grew too large: ${context.length} chars`);
  assert.doesNotMatch(context, /BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9]{16,}/);
});

test("#1909 C4 context container and component views derive from the same canonical map", () => {
  const c4 = renderC4(architecture, fingerprint);
  assert.equal(c4, read("architecture/plotpickle-c4.md"));
  assert.match(c4, /## System Context/);
  assert.match(c4, /## Container view/);
  assert.match(c4, /## Component view/);
  for (const layer of architecture.layers) {
    assert.match(c4, new RegExp(layer.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    for (const component of layer.components) assert.ok(c4.includes(component.title), `missing C4 component ${component.title}`);
  }
});

test("#1909 archive identity is deterministic, append-only and unchanged refreshes do not duplicate history", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plotpickle-1909-archive-"));
  const block = renderCurrentUpdate(architecture, fingerprint, currentEvidence);
  const first = archiveCurrentUpdate(root, block);
  const firstPath = path.join(root, "docs", "updates", "archive", first);
  const bytes = fs.readFileSync(firstPath, "utf8");
  const second = archiveCurrentUpdate(root, block);
  assert.equal(second, first);
  assert.equal(fs.readFileSync(firstPath, "utf8"), bytes);
  assert.equal(fs.readdirSync(path.dirname(firstPath)).length, 1);
  assert.equal(first, stableArchiveFilename(block));
  assert.deepEqual(validateArchiveHistory(root), []);
  assert.match(renderHistoryIndex(root), new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("#1909 changed current entry archives the prior identity exactly once", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plotpickle-1909-change-"));
  const oldBlock = renderCurrentUpdate(architecture, fingerprint, currentEvidence);
  const oldName = archiveCurrentUpdate(root, oldBlock);
  const changedArchitecture = structuredClone(architecture);
  changedArchitecture.blueprint.tagline = `${changedArchitecture.blueprint.tagline} / archive-test`;
  const newFingerprint = fingerprintArchitecture(changedArchitecture);
  const newBlock = renderCurrentUpdate(changedArchitecture, newFingerprint, currentEvidence);
  const newName = archiveCurrentUpdate(root, newBlock);
  assert.notEqual(newName, oldName);
  assert.equal(fs.readdirSync(path.join(root, "docs", "updates", "archive")).length, 2);
});

test("#1909 check mode is non-mutating and current repository living outputs are synchronized", () => {
  const archiveDir = path.join(ROOT, "docs", "updates", "archive");
  const before = fs.existsSync(archiveDir)
    ? Object.fromEntries(fs.readdirSync(archiveDir).sort().map((name) => [name, fs.readFileSync(path.join(archiveDir, name), "utf8")]))
    : {};
  const run = spawnSync(process.execPath, ["architecture/generate-living-architecture.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  const after = fs.existsSync(archiveDir)
    ? Object.fromEntries(fs.readdirSync(archiveDir).sort().map((name) => [name, fs.readFileSync(path.join(archiveDir, name), "utf8")]))
    : {};
  assert.deepEqual(after, before);
  assert.match(run.stdout, /Living architecture is synchronized/);
});

test("#1909 existing architecture blueprint generation remains synchronized", () => {
  const run = spawnSync(process.execPath, ["architecture/generate-architecture.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});
