import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { splitConnectionConfirmationPreview } from "../app/_components/settings/connection-confirmation-presentation.mjs";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const preview = (token, extra = "charges") =>
  `CONNECTION PREVIEW - test image/openai\nCurrently selected: comfyui. Provider requests may incur charges. No mutation or inference yet. Within two minutes send: PlotPickle connections confirm ${token}${extra ? " " + extra : ""}. Cancel with PlotPickle connections cancel. Never paste API keys into Command.`;

test("#3034 dynamic approved connection confirmation is visibly separate and full text is unchanged", () => {
  const message = preview("0123456789abcdef");
  const chunks = splitConnectionConfirmationPreview(message, true);
  assert.equal(chunks.map(item => item.text).join(""), message);
  assert.equal(chunks.filter(item => item.emphasis).length, 1);
  assert.equal(chunks.find(item => item.emphasis).text, "PlotPickle connections confirm 0123456789abcdef charges");
  assert.equal(chunks.find(item => item.emphasis).text.includes("comfyui"), false);
  assert.equal(chunks.find(item => item.emphasis).text.includes("paste API keys"), false);
});

test("#3034 can highlight exactly the required charge/share/performance flags without hardcoded user token", () => {
  for (const flags of ["", "charges", "charges share", "share", "performance", "charges share performance"]) {
    const token = "fedcba9876543210";
    const result = splitConnectionConfirmationPreview(preview(token, flags), true);
    assert.equal(result.filter(x => x.emphasis).length, 1);
    assert.equal(result.filter(x => x.emphasis)[0].text,
      `PlotPickle connections confirm ${token}${flags ? " " + flags : ""}`);
  }
});

test("#3034 false previews, user messages and invalid tokens remain plain", () => {
  for (const input of [
    preview("0123456789abcdef"),
    "Tool output: PlotPickle connections confirm 0123456789abcdef charges",
    "BLOCKED: The preview expired. PlotPickle connections confirm 0123456789abcdef charges",
    preview("0123"),
    "PLOTPICKLE CONNECTIONS CONFIRM 0123456789ABCDEF CHARGES",
  ]) {
    const pieces = splitConnectionConfirmationPreview(input, false);
    assert.deepEqual(pieces, [{ text: input, emphasis: false }]);
  }
  for (const bad of [preview("0123"), preview("0123456789abcdez")]) {
    assert.equal(splitConnectionConfirmationPreview(bad, true).some(x => x.emphasis), false);
  }
});

test("#3034 ONLY host-owned tool preview gets orange noninteractive HTML presentation", async () => {
  const [host, css, palette, controller] = await Promise.all([
    source("app/skin-v1/global-dsdd-conversation.tsx"),
    source("app/skin-v1/global-dsdd-conversation.module.css"),
    source("app/skin-v1-definition.css"),
    source("app/_components/settings/connection-command.mjs"),
  ]);
  assert.match(host, /message\.role === "tool" && message\.id\.startsWith\("connections-result"\)/u);
  assert.match(host, /className=\{styles\.connectionConfirmation\}/u);
  assert.match(host, /data-cmd-confirmation="action"/u);
  assert.match(css, /\.connectionConfirmation\s*\{[\s\S]*display:\s*block/u);
  assert.match(css, /\.connectionConfirmation\s*\{[\s\S]*color:\s*var\(--pp-skin-confirmation-ink/u);
  assert.match(css, /overflow-wrap:\s*anywhere/u);
  assert.match(palette, /--pp-skin-confirmation-ink:\s*#ffb46a/u);
  assert.match(controller, /expires:\s*services\.now\(\)\s*\+\s*120_000/u);
  assert.match(controller, /if \(command\.action === "confirm"\)/u);
  assert.doesNotMatch(host, /clipboard\.writeText\(message\.text\)|automaticallyConfirm/iu);
});
