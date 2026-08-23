import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Studio identity is random, persistent and separate from mutable naming", async () => {
  const source = await read("build/studio-identity.ts");
  assert.match(source, /randomBytes/);
  assert.match(source, /pp_studio_/);
  assert.match(source, /PlotPickle Studio/);
  assert.match(source, /studioDisplayName/);
  assert.match(source, /readCredentialJson<unknown>\(FILE\)/);
  assert.match(source, /writeCredentialJson\(FILE, identity\)/);
  assert.doesNotMatch(source, /os\.hostname|os\.userInfo|process\.env\.USERNAME|LOCALAPPDATA.*studioId/i);
});

test("Studio signing identity is Ed25519 and the public projection never exposes its private key", async () => {
  const [identity, gateway, page] = await Promise.all([
    read("build/studio-identity.ts"), read("build/studio-identity-gateway.ts"), read("app/studio-identity/page.tsx"),
  ]);
  assert.match(identity, /generateKeyPairSync\("ed25519"\)/);
  assert.match(identity, /privateKeyPem/);
  assert.match(identity, /publicKeyPem/);
  assert.match(identity, /signing: \{ algorithm: identity\.signing\.algorithm, publicKeyPem: identity\.signing\.publicKeyPem \}/);
  assert.doesNotMatch(gateway, /privateKeyPem/);
  assert.doesNotMatch(page, /privateKeyPem/);
  assert.match(page, /Private signing key never leaves encrypted local storage/);
});

test("rename keeps immutable identity, records history, and enforces rolling 30-day cooldown", async () => {
  const source = await read("build/studio-identity.ts");
  assert.match(source, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(source, /identity\.renameHistory\.push/);
  assert.match(source, /identity\.prefix = prefix/);
  assert.match(source, /identity\.displayName = studioDisplayName\(prefix\)/);
  assert.doesNotMatch(source.split("renameStudioIdentity")[1] || "", /identity\.studioId\s*=/);
  assert.doesNotMatch(source.split("renameStudioIdentity")[1] || "", /privateKeyPem\s*=/);
  assert.match(source, /This Studio can be renamed again after/);
});

test("duplicate names do not affect identity and reserved suffix stays system-owned", async () => {
  const [source, page] = await Promise.all([read("build/studio-identity.ts"), read("app/studio-identity/page.tsx")]);
  assert.doesNotMatch(source, /unique.*display|duplicate.*reject|name.*available/i);
  assert.match(source, /Enter only the prefix/);
  assert.match(page, /Public name preview/);
  assert.match(page, /The suffix “\{SUFFIX\}” is reserved and added by PlotPickle/);
  assert.match(page, /Studio \{identity\.shortCode\}/);
});

test("Studio identity setup is locally gated, registered, and discoverable from onboarding", async () => {
  const [gateway, aggregate, start] = await Promise.all([
    read("build/studio-identity-gateway.ts"), read("build/local-ai-gateway.ts"), read("app/start-here/page.tsx"),
  ]);
  assert.match(gateway, /\/api\/studio-identity/);
  assert.match(gateway, /127\.0\.0\.1/);
  assert.match(gateway, /::1/);
  assert.match(aggregate, /registerStudioIdentityGateway\(server\)/);
  assert.match(start, /href="\/studio-identity"/);
});
