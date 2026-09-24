import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const editorialUrl = new URL("../app/_components/storyboard/storyboard-editorial-model.ts", import.meta.url);
const workspaceUrl = new URL("../app/_components/storyboard/storyboard-readiness-workspace.tsx", import.meta.url);

test("#2418 maps selected, five-frame and full Mini-Block scopes deterministically", async () => {
  const source = await readFile(editorialUrl, "utf8");
  assert.match(source, /export type StoryboardGenerationScope = "single" \| "group5" \| "all25"/u);
  assert.match(source, /if \(scope === "single"\) return \[selected\]/u);
  assert.match(source, /if \(scope === "all25"\) return Array\.from\(\{ length: 25 \}, \(_, index\) => index \+ 1\)/u);
  assert.match(source, /const start = Math\.floor\(\(selected - 1\) \/ 5\) \* 5 \+ 1/u);
  assert.match(source, /return Array\.from\(\{ length: 5 \}, \(_, index\) => start \+ index\)/u);
});

test("#2418 defines 25 distinct progression roles and position-specific screenplay windows", async () => {
  const source = await readFile(editorialUrl, "utf8");
  const start = source.indexOf("const POSITION_STORY_FUNCTIONS = [");
  const end = source.indexOf("] as const;", start);
  assert.ok(start >= 0 && end > start, "Missing Storyboard position progression table.");
  const table = source.slice(start, end);
  const rows = table.match(/^\s{2}"[^\n]+",$/gmu) ?? [];
  assert.equal(rows.length, 25);
  assert.equal(new Set(rows).size, 25);
  assert.match(source, /function passageWindow\(/u);
  assert.match(source, /Math\.floor\(\(\(position - 1\) \* passages\.length\) \/ 25\)/u);
  assert.match(source, /Math\.ceil\(\(position \* passages\.length\) \/ 25\)/u);
  assert.match(source, /evidenceSummary/u);
  assert.match(source, /visibleChange:/u);
});

test("#2418 injects explicit character truth and locked approved references only when applicable", async () => {
  const [editorial, workspace] = await Promise.all([
    readFile(editorialUrl, "utf8"),
    readFile(workspaceUrl, "utf8"),
  ]);
  assert.match(editorial, /Canonical character truth for characters actually present in this frame/u);
  assert.match(editorial, /locked approved character visual references are attached/u);
  assert.match(editorial, /keep identity exploratory and do not imply visual canon/u);
  assert.match(workspace, /approvedCharacterReferenceImages\(visualCharacter\)/u);
  assert.match(workspace, /identity\.status === "locked"/u);
  assert.match(workspace, /reference\.startsWith\("\/api\/local-ai\/assets\/"\)/u);
  assert.match(workspace, /aliases: character\.id === "isobel" \? \["Summer"\] : \[\]/u);
  assert.match(workspace, /claim\.handling === "writer-reference"/u);
  assert.match(workspace, /claim\.kind !== "sensitive-source"/u);
});

test("#2418 final prompt carries frame-specific story progression instead of one Mini-Block prompt repeated", async () => {
  const source = await readFile(editorialUrl, "utf8");
  assert.match(source, /Frame-brief story function:/u);
  assert.match(source, /Required visible progression:/u);
  assert.match(source, /Position-specific screenplay evidence:/u);
  assert.match(source, /Continuity-in:/u);
  assert.match(source, /Continuity-out:/u);
  assert.match(source, /This is a visual coverage function, not a Beat assignment/u);
});

test("#2418 Storyboard UI submits separate local WebP requests with 1 5 25 scope and character grounding", async () => {
  const source = await readFile(workspaceUrl, "utf8");
  assert.match(source, /useState<StoryboardGenerationScope>\("group5"\)/u);
  assert.match(source, /Selected frame/u);
  assert.match(source, /Current group of 5/u);
  assert.match(source, /All 25 frames/u);
  assert.match(source, /I approve this image generation request through my configured provider/u);
  assert.match(source, /storyboardPositionsForScope\(promptPosition, generationScope\)/u);
  assert.match(source, /for \(let index = 0; index < positions\.length; index \+= 1\)/u);
  assert.match(source, /approvedCharacterReferences: plan\.brief\.approvedVisualRefs/u);
  assert.match(source, /identityLocks: plan\.brief\.identityLocks/u);
  assert.match(source, /frameNumber: position/u);
  assert.match(source, /workflow: "storyboard-frame-webp-v2"/u);
  assert.match(source, /reviewState: "draft"/u);
  assert.match(source, /saved locally for review/u);
});

test("#2418 current diff converges and production build succeeds", { timeout: 240_000 }, async (t) => {
  const changed = changedFilesFromGit({ root });
  if (!changed.includes("config/development-convergence/2418.json")) {
    t.skip("#2418 convergence/build proof only runs while its convergence manifest is part of the current diff.");
    return;
  }

  const convergence = await runDevelopmentConvergence(["--changed"], root);
  assert.equal(convergence.exitCode, 0);
  const report = convergence.reports.find((candidate) => candidate.issue === 2418);
  assert.equal(report?.status, "CONVERGED");

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    await access(path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite"));
  } catch {
    execFileSync(npm, ["ci", "--include=dev", "--no-audit", "--no-fund"], {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });
  }
  execFileSync(npm, ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
});
