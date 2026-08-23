import "./issue-1048-readme-branding.test.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

test("README describes the current PlotPickle product spine and Visual Writer progression", () => {
  assert.match(readme, /Dashboard · Community · LEARN · PLAN · BUILD · Wyrmwood · Settings/);
  assert.match(readme, /LEARN → PLAN → BUILD/);
  assert.match(readme, /Foundations/);
  assert.match(readme, /World/);
  assert.match(readme, /Character is the next Visual Writer frontier/);
  assert.match(readme, /complete 81-lesson curriculum/);
});

test("README leads with the current local-first writer-controlled positioning", () => {
  assert.match(readme, /local-first creative studio/i);
  assert.match(readme, /The writer remains the author/);
  assert.match(readme, /AI can explain, draft, visualize, test and suggest/);
  assert.match(readme, /does not silently turn generated material into story canon/);
});

test("README preserves the shared three-column workspace contract", () => {
  assert.match(readme, /19% left/);
  assert.match(readme, /56% centre/);
  assert.match(readme, /25% right/);
  assert.match(readme, /Community\/BBS follows the same contract/);
});

test("README shows the current authority architecture", () => {
  assert.match(readme, /```mermaid/);
  assert.match(readme, /PPF creative record/);
  assert.match(readme, /Mastra product-agent runtime/);
  assert.match(readme, /BUZZ signed room history/);
  assert.match(readme, /GitHub.*canonical source, issues, pull requests and merge authority/s);
  assert.match(readme, /never automatic canon/);
});

test("README keeps current helpers and Community roles visible", () => {
  for (const name of [
    "Sage Brinewick",
    "Tamsin Hearthquill",
    "Master Oaken-Vague",
    "Rowan Scalequill",
    "Avery North",
    "Luma Glassfern",
    "Bram Gatewick",
    "Orin Ledgerbark",
    "Merrin Bellwarden",
    "Fen Copperwind",
  ]) {
    assert.match(readme, new RegExp(name));
  }
  assert.match(readme, /Settings → Help/);
  assert.match(readme, /16-bit full-body/);
  assert.match(readme, /Sage keeps the established approved portrait/);
});

test("README documents BUZZ as shared Community transport without automatic creative-state mirroring", () => {
  assert.match(readme, /same signed BUZZ room history/);
  assert.match(readme, /BUZZ event IDs/);
  assert.match(readme, /BUZZ Desktop/);
  assert.match(readme, /LEARN answers, PLAN decisions, BUILD artifacts, PPF state/);
  assert.match(readme, /remain local unless the writer explicitly shares content/);
  assert.doesNotMatch(readme, /\bPlayhouse\b/i);
});

test("README documents local AI and ComfyUI without silent paid fallback", () => {
  assert.match(readme, /Ollama/);
  assert.match(readme, /LM Studio/);
  assert.match(readme, /llama\.cpp/);
  assert.match(readme, /managed ComfyUI instance headlessly/);
  assert.match(readme, /Installed · Running · Model ready · Test needed · Active/);
  assert.match(readme, /127\.0\.0\.1:8188/);
  assert.match(readme, /never silently becomes a paid request/);
});

test("README keeps the current verification and authority boundaries clear", () => {
  assert.match(readme, /build, test, fix, merge only when green/i);
  assert.match(readme, /focused deterministic regressions/);
  assert.match(readme, /Writer-in-Residence/);
  assert.match(readme, /BEN code-quality review/);
  assert.match(readme, /Pi is an optional bounded repair worker/);
  assert.match(readme, /GitHub remains code\/PR\/merge authority|GitHub.*merge authority/s);
});

test("README provides current development commands and license", () => {
  assert.match(readme, /Node\.js 22\.13 or newer/);
  assert.match(readme, /npm install/);
  assert.match(readme, /npm run dev:local/);
  assert.match(readme, /npm test/);
  assert.match(readme, /npm run build/);
  assert.match(readme, /AGPL-3\.0-or-later/);
});
