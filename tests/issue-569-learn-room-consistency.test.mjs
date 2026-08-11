import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const shellPath = "app/learn-three-column-shell.tsx";
const cssPath = "app/learn-three-column-shell.module.css";

test("Creative Room sends the selected specialist conversation through the configured assistant", async () => {
  const shell = await readFile(shellPath, "utf8");
  assert.match(shell, /\/api\/writing-assistant\/status/);
  assert.match(shell, /\/api\/writing-assistant\/chat/);
  assert.match(shell, /Speak as PlotPickle's \$\{activeAgent\.label\}/);
  assert.match(shell, /Conversation tone: \$\{tone\}/);
  assert.match(shell, /Active story:/);
  assert.match(shell, /Story position: Act/);
  assert.match(shell, /history/);
  assert.doesNotMatch(shell, /setMessages\(\(current\) => \[\.\.\.current, `You:/);
});

test("Creative Room exposes an honest disabled state and a Settings route", async () => {
  const shell = await readFile(shellPath, "utf8");
  const page = await readFile("app/page.tsx", "utf8");
  assert.match(shell, /explicitlyDisabled/);
  assert.match(shell, /Open Writing Assistant Settings/);
  assert.match(shell, /status\.activeProvider === "disabled"/);
  assert.match(page, /onOpenSettings=\{\(\) => setActiveTab\("settings"\)\}/);
});

test("an installed Ollama model becomes the local default unless Off was deliberate", async () => {
  const gateway = await readFile("build/writing-assistant-gateway.ts", "utf8");
  assert.match(gateway, /probe\.reachable && probe\.models\.length > 0/);
  assert.match(gateway, /store\.activeProvider === "disabled" && !store\.explicitlyDisabled/);
  assert.match(gateway, /store\.activeProvider = "ollama"/);
  assert.match(gateway, /await writeAssistantStore\(store\)/);
});

test("Learn navigation belongs to the Creative Canvas instead of a fourth column", async () => {
  const shell = await readFile(shellPath, "utf8");
  const page = await readFile("app/page.tsx", "utf8");
  const css = await readFile(cssPath, "utf8");
  assert.match(shell, /canvasToolbar/);
  assert.match(page, /toolbar=\{<nav className="learn-section-tabs"/);
  assert.match(css, /position: sticky !important/);
  assert.match(css, /flex-direction: row !important/);
  assert.match(css, /inset: auto !important/);
  assert.match(css, /::before \{ display: none !important; \}/);
});

test("the three-column room and composer remain inside the desktop viewport", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /height: calc\(100dvh - 148px\)/);
  assert.match(css, /\.room \{[^}]*overflow: hidden/s);
  assert.match(css, /\.thread \{[^}]*overflow: auto/s);
  assert.match(css, /\.composer \{[^}]*flex: 0 0 auto/s);
});

test("the approved matte-black, antique-gold and typewriter system wins inside Learn", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /--charcoal-0: #080a0b/);
  assert.match(css, /--tungsten-4: #f0d28a/);
  assert.match(css, /"Courier New", Consolas, monospace/);
  assert.match(css, /background-color: #10100f !important/);
  assert.match(css, /border-radius: 0 !important/);
  assert.doesNotMatch(css, /#(?:398187|4da29d|73b7aa|32d4df|bfeef1)/i);
});
