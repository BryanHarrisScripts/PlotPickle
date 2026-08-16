import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(root, "config", "buzz-guildhall.json"), "utf8"));
const bridge = await readFile(path.join(root, "lib", "buzz-guildhall.ts"), "utf8");
const bootstrap = await readFile(path.join(root, "scripts", "bootstrap-buzz-guildhall.mjs"), "utf8");
const docs = await readFile(path.join(root, "docs", "buzz-guildhall.md"), "utf8");

const requiredRooms = [
  "great-hall",
  "lore-library",
  "wayfarer-journal",
  "wyrmwood-ring",
  "story-council",
  "thread-vault",
  "lantern-watch",
  "gatehouse",
  "forge",
  "github-herald",
  "archive",
];

const requiredActors = new Map([
  ["sage-brinewick", ["Sage Brinewick", "Lorekeeper"]],
  ["master-oaken-vague", ["Master Oaken-Vague", "Keeper of the Wyrmwood"]],
  ["avery-north", ["Avery North", "The Wayfarer"]],
  ["luma-glassfern", ["Luma Glassfern", "Lantern Warden"]],
  ["bram-gatewick", ["Bram Gatewick", "Gatewarden"]],
  ["rook-ironquill", ["Rook Ironquill", "Forgekeeper"]],
  ["orin-ledgerbark", ["Orin Ledgerbark", "Archivist of the Hall"]],
  ["fen-copperwind", ["Fen Copperwind", "Herald of the Forge"]],
]);

test("Guildhall defines unique private coordination rooms", () => {
  assert.equal(config.schemaVersion, 1);
  const names = config.channels.map((room) => room.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual([...names].sort(), [...requiredRooms].sort());
  for (const room of config.channels) {
    assert.equal(room.visibility, "private");
    assert.match(room.name, /^[a-z0-9][a-z0-9-]{2,71}$/);
    assert.ok(["stream", "forum"].includes(room.type));
    assert.ok(room.description.length >= 20);
  }
});

test("Guildhall preserves existing agents and adds original lore titles", () => {
  const ids = config.actors.map((actor) => actor.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const [id, [name, title]] of requiredActors) {
    const actor = config.actors.find((item) => item.id === id);
    assert.ok(actor, `${id} should exist`);
    assert.equal(actor.displayName, name);
    assert.equal(actor.title, title);
    assert.ok(requiredRooms.includes(actor.primaryChannel));
  }
  assert.equal(config.actors.find((actor) => actor.id === "sage-brinewick")?.existingRoleId, "curriculum-guide");
  assert.equal(config.actors.find((actor) => actor.id === "master-oaken-vague")?.existingRoleId, "wyrmwood-rival-director");
  assert.equal(config.actors.find((actor) => actor.id === "rowan-scalequill")?.existingRoleId, "wyrmwood-curriculum-evaluator");
});

test("only Guildhall-specific stewards are drafted as BUZZ-native agents", () => {
  const nativeDrafts = config.actors.filter((actor) => actor.buzzPresence === "native-draft");
  assert.deepEqual(nativeDrafts.map((actor) => actor.id).sort(), ["fen-copperwind", "orin-ledgerbark"]);
  for (const actor of nativeDrafts) {
    assert.equal(actor.runtime, "buzz");
    assert.ok(actor.systemPrompt.length > 120);
    assert.doesNotMatch(actor.systemPrompt, /auto[- ]?merge|silently change canon/i);
  }
  assert.equal(config.actors.find((actor) => actor.id === "sage-brinewick")?.runtime, "mastra");
  assert.equal(config.actors.find((actor) => actor.id === "master-oaken-vague")?.runtime, "mastra");
});

test("event routing covers every registered event and uses safe authority boundaries", () => {
  const channelIds = new Set(config.channels.map((channel) => channel.id));
  for (const [eventType, channelId] of Object.entries(config.eventRoutes)) {
    assert.match(eventType, /^[a-z]+\.[a-z-]+$/);
    assert.ok(channelIds.has(channelId), `${eventType} should point at a real Guildhall room`);
  }
  assert.equal(config.privacy.automaticPpfWrites, false);
  assert.equal(config.privacy.automaticGithubMerge, false);
  assert.match(config.authority.creative, /PPF remains the canonical creative record/i);
  assert.match(config.authority.code, /GitHub remains the canonical code/i);
  assert.match(config.authority.agentRuntime, /Mastra remains the PlotPickle product-agent runtime/i);
});

test("PlotPickle bridge reuses the existing encrypted local BUZZ gateway", () => {
  assert.match(bridge, /const BUZZ_API = "\/api\/local-buzz"/);
  assert.match(bridge, /buzzRequest<\{ rooms: BuzzChannel\[\] \}>\("\/rooms"/);
  assert.match(bridge, /buzzRequest\("\/messages"/);
  assert.match(bridge, /guildhall-not-bootstrapped/);
  assert.match(bridge, /canEscalateBuzzGuildhallEventToGitHub/);
  assert.match(bridge, /requiresVerified/);
  assert.match(bridge, /requiresActionable/);
  assert.doesNotMatch(bridge, /localStorage|sessionStorage/);
});

test("bootstrap is dry-run by default and keeps agent creation owner-reviewed", () => {
  assert.match(bootstrap, /const apply = hasFlag\("--apply"\)/);
  assert.match(bootstrap, /channels", "list/);
  assert.match(bootstrap, /"channels", "create"/);
  assert.match(bootstrap, /"agents", "draft-create"/);
  assert.match(bootstrap, /BUZZ_RELAY_URL/);
  assert.match(bootstrap, /BUZZ_PRIVATE_KEY/);
  assert.match(bootstrap, /owner-reviewed/i);
  assert.match(bootstrap, /Nothing was written/);
  assert.doesNotMatch(bootstrap, /console\.log\(process\.env\.BUZZ_PRIVATE_KEY|print\([^\n]*BUZZ_PRIVATE_KEY/);
});

test("documentation explains the authority and no-duplicate-agent model", () => {
  assert.match(docs, /PPF is the creative authority/i);
  assert.match(docs, /GitHub is the code authority/i);
  assert.match(docs, /Mastra remains the product-agent runtime/i);
  assert.match(docs, /not a second autonomous copy/i);
  assert.match(docs, /Orin Ledgerbark/);
  assert.match(docs, /Fen Copperwind/);
  assert.match(docs, /owner-reviewed/i);
});
