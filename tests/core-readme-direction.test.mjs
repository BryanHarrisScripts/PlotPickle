import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

const has = (text) => assert.ok(readme.includes(text), `README missing current shipping contract: ${text}`);

test("README leads with the current local-first writer-controlled product promise", () => {
  has("<strong>Learn the craft. Make the decisions. See the story take shape.</strong>");
  has("Local-first · Writer-controlled · Visual story shaping · AI optional · BUZZ-connected");
  has("**The Human remains the author.** AI can explain, suggest, draft, visualize and test ideas, but generated material does not silently become story canon.");
});

test("README tells testers how to install and start PlotPickle on Windows", () => {
  has("## Get PlotPickle");
  has("`PlotPickleSetup.exe`");
  has("Testers do **not** need to install Git, Node.js, npm, Rust or open a command window.");
  has("### First launch");
  has("Settings → Help");
  has("There is no required paid AI provider and no silent local-to-paid-cloud fallback.");
});

test("README explains the current creative workflow and deterministic production scaffold", () => {
  for (const heading of ["### Learn", "### Plan", "### Build", "### Write and Edit", "### Feedback and Refine", "### Community and BUZZ"]) has(heading);
  has("**Story Coverage → Story Workflow → Wireframe → Storyboard → Previs → Render Plan**");
  has("**24 Story Blocks → 96 Mini-Blocks → 2,400 technical 3-second render clips**");
  has("That gives every generated clip a stable address and allows surgical regeneration instead of rebuilding an entire scene because one three-second result failed.");
});

test("README keeps PPF and Human authority explicit", () => {
  has("The PPF is PlotPickle's canonical creative record.");
  has("- the writer owns final creative decisions;");
  has("- AI output is proposal material until accepted;");
  has("- Storyboard and Previs cannot silently rewrite upstream story canon;");
  has("- BUZZ conversation does not become canon automatically;");
});

test("README documents optional capability connections without silent paid fallback", () => {
  has("Local text/model runtimes can include Ollama, LM Studio, llama.cpp and other OpenAI-compatible endpoints.");
  has("Local image/video workflows can use ComfyUI.");
  has("Optional cloud/BYOK providers remain separately configured and require the existing consent boundaries for paid work.");
  has("Core PlotPickle should still open and remain useful when those optional services are unavailable.");
});

test("README keeps privacy and Community boundaries clear", () => {
  has("PlotPickle does **not** automatically upload your screenplay, PPF, local files, prompts, credentials or private story work.");
  has("Sharing into a Community is an explicit action.");
  has("Credentials do not belong in PPF story files.");
  has("Community presence does not make another person's computer available as compute.");
});

test("README provides current developer commands, packaging path and license", () => {
  has("Node.js **22.13 or newer**;");
  has("npm ci");
  has("npm run dev:local");
  has("npm test");
  has("npm run build");
  has("npm run package:windows");
  has("PlotPickle is licensed under **AGPL-3.0-or-later**.");
});
