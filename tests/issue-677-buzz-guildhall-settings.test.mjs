import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gateway = await readFile(path.join(root, "build", "buzz-guildhall-gateway.ts"), "utf8");
const settings = await readFile(path.join(root, "app", "buzz-settings-panel.tsx"), "utf8");
const vite = await readFile(path.join(root, "vite.config.ts"), "utf8");
const config = JSON.parse(await readFile(path.join(root, "config", "buzz-guildhall.json"), "utf8"));

test("Guildhall gateway owns one-click local setup without GitHub secrets", () => {
  assert.match(gateway, /const API = "\/api\/local-buzz\/guildhall"/);
  assert.match(gateway, /readCredentialJson<unknown>\(CONNECTION_FILE\)/);
  assert.match(gateway, /resolveBuzzCliExecutable\(connection\.cliPath\)/);
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/);
  assert.match(gateway, /verificationVersion !== 2/);
  assert.match(gateway, /"channels", "create"/);
  assert.match(gateway, /"--visibility", definition\.visibility/);
  assert.doesNotMatch(gateway, /GITHUB_(?:TOKEN|SECRET)|github_pat_|ghp_/i);
  assert.doesNotMatch(gateway, /process\.env\.BUZZ_AUTH_TAG|BUZZ_AUTH_TAG\s*:/);
});

test("one-click setup is idempotent and verifies all eleven private rooms", () => {
  assert.equal(config.channels.length, 11);
  assert.ok(config.channels.every((room) => room.visibility === "private"));
  assert.match(gateway, /channels\.some\(\(channel\) => channel\.name === definition\.name\)/);
  assert.match(gateway, /kept\.push\(definition\.name\)/);
  assert.match(gateway, /created\.push\(definition\.name\)/);
  assert.match(gateway, /if \(!rooms\.ready\)/);
  assert.match(gateway, /PlotPickle Guildhall is operational/);
});

test("Guildhall middleware runs before the broad Buzz gateway", () => {
  assert.match(vite, /import \{ buzzGuildhallGateway \} from "\.\/build\/buzz-guildhall-gateway"/);
  const guildhallIndex = vite.indexOf("buzzGuildhallGateway(),");
  const buzzIndex = vite.indexOf("buzzGateway(),");
  assert.ok(guildhallIndex >= 0);
  assert.ok(buzzIndex >= 0);
  assert.ok(guildhallIndex < buzzIndex, "Guildhall middleware must run before the broad /api/local-buzz handler");
});

test("Settings exposes one-click Guildhall setup and operational status", () => {
  assert.match(settings, /Set up PlotPickle Guildhall/);
  assert.match(settings, /\/guildhall\/status/);
  assert.match(settings, /\/guildhall\/setup/);
  assert.match(settings, /Guildhall operational/);
  assert.match(settings, /readyCount/);
  assert.match(settings, /totalCount/);
  assert.match(settings, /No GitHub BUZZ secret is needed/);
  assert.match(settings, /Do not put your Buzz nsec in GitHub/);
});

test("Settings preserves BUZZ owner review for Orin and Fen", () => {
  assert.match(settings, /Orin and Fen still require your approval in Buzz Desktop/);
  assert.match(settings, /Copy \{steward\.displayName\} setup/);
  assert.match(settings, /navigator\.clipboard\.writeText/);
  assert.match(settings, /NIP-OA owner authorization/);
  assert.match(settings, /owner-authorized Buzz agent/);
  assert.doesNotMatch(settings, /agents\W+draft-create/);
  assert.doesNotMatch(settings, /auto(?:matic)?[- ]?approve/i);
});

test("Guildhall local API remains loopback-only and redacts credentials", () => {
  assert.match(gateway, /isLoopback/);
  assert.match(gateway, /Buzz Guildhall controls are available only from the local PlotPickle application/);
  assert.match(gateway, /\[redacted-nsec\]/);
  assert.match(gateway, /\[redacted-secret\]/);
  assert.doesNotMatch(gateway, /console\.log\(.*privateKey|process\.stdout\.write\(.*privateKey/);
});
