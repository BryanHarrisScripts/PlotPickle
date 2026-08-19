import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("#1066 keeps the desktop Community shell on the canonical 19/56/25 composition", async () => {
  const css = await read("app/community-navigation.module.css");
  assert.match(css, /\.communityLayout\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /grid-template-columns:\s*minmax\(220px,\s*19fr\)\s+minmax\(0,\s*56fr\)\s+minmax\(240px,\s*25fr\)/);
  assert.match(css, /\.communityRail\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(css, /\.communityContent\s*\{[^}]*grid-column:\s*2\s*\/\s*4;[^}]*grid-template-columns:\s*minmax\(0,\s*56fr\)\s+minmax\(240px,\s*25fr\)/s);
  assert.doesNotMatch(css, /\.communityLayout\s*\{[^}]*display:\s*contents;/s);
  assert.doesNotMatch(css, /grid-template-columns:\s*minmax\(220px,\s*19fr\)\s+minmax\(0,\s*81fr\)/);
});

test("#1066 keeps the terminal screen and command/context rail at the intended 56/25 split", async () => {
  const [css, terminal] = await Promise.all([
    read("app/community-navigation.module.css"),
    read("app/community-backdoor-terminal.tsx"),
  ]);
  assert.match(css, /data-community-terminal="backdoor-v1"[^\n]*PlotPickle Community BBS terminal[^\n]*> div:last-child\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*56fr\)\s+minmax\(240px,\s*25fr\)/s);
  assert.match(terminal, /aside className=\{styles\.commandRail\} aria-label="Terminal keyboard commands"/);
  assert.match(terminal, /const COMMANDS:/);
});

test("#1066 preserves the BBS default entry and truthful BUZZ identity", async () => {
  const workspace = await read("app/community-workspace.tsx");
  assert.match(workspace, /useState<CommunitySection>\("terminal"\)/);
  assert.match(workspace, /const nodeName = community\?\.community\.trim\(\) \|\| ""/);
  assert.match(workspace, /nodeName=\{nodeName\}/);
  assert.match(workspace, /BUZZ NODE UNAVAILABLE/);
  assert.doesNotMatch(workspace, /const\s+[^=]*NODE[^=]*=\s*["']plotpickle-community["']/i);
});

test("#1066 preserves keyboard safety and collapses deliberately only below desktop widths", async () => {
  const [css, terminal] = await Promise.all([
    read("app/community-navigation.module.css"),
    read("app/community-backdoor-terminal.tsx"),
  ]);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*\.communityLayout\s*\{[^}]*grid-template-columns:\s*minmax\(200px,\s*28fr\)\s+minmax\(0,\s*72fr\)/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.communityLayout\s*\{[^}]*grid-template-columns:\s*1fr;/);
  assert.match(terminal, /editableTarget\(event\.target\)/);
  assert.match(terminal, /\["INPUT", "TEXTAREA", "SELECT"\]/);
  assert.match(terminal, /target\.isContentEditable/);
});
