import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settings = await readFile(new URL("../lib/ai/settings.ts", import.meta.url), "utf8");

test("settings keep AI, music, and future plugins in one local model", () => {
  assert.match(settings, /type PlotPickleSettings/);
  assert.match(settings, /provider: AiProviderKind/);
  assert.match(settings, /service: MusicService/);
  assert.match(settings, /status: "coming-soon"/);
});

test("settings never include API-key storage", () => {
  assert.doesNotMatch(settings, /apiKey|secretValue|accessToken/);
});

test("music artist links are limited to Suno and Udio HTTPS profiles", () => {
  assert.match(settings, /"suno" \| "udio"/);
  assert.match(settings, /url\.protocol !== "https:"/);
  assert.match(settings, /hostname === "suno\.com"/);
  assert.match(settings, /hostname === "udio\.com"/);
});
