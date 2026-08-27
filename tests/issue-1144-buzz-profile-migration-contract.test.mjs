import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("#1144 legacy BUZZ migration targets only the active AuthContext profile and never accepts a browser-selected owner", async () => {
  const source = await readFile(new URL("../build/buzz/buzz-profile-migration-gateway.ts", import.meta.url), "utf8");
  assert.match(source, /currentProfileRequestContext\(\)/);
  assert.match(source, /context\.privateStorage\.migrateLegacyProfile\(context\.authContext, source\)/);
  assert.match(source, /assignment\.profileId !== context\.profileId/);
  assert.match(source, /cannot be duplicated/);
  assert.match(source, /migrationQueue/);
  assert.doesNotMatch(source, /searchParams\.get\(["']profileId["']\)/);
  assert.doesNotMatch(source, /body\.profileId/);
  assert.doesNotMatch(source, /privateKey/);
});

test("#1144 migration reads the legacy single-user source only outside the per-request Human context", async () => {
  const [migrationSource, contextSource] = await Promise.all([
    readFile(new URL("../build/buzz/buzz-profile-migration-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../build/auth/profile-request-context.ts", import.meta.url), "utf8"),
  ]);
  assert.match(migrationSource, /createLegacyCredentialMigrationSource\(\[CONNECTION_FILE\]\)/);
  assert.match(migrationSource, /profileRequestScope\.exit\(\(\) => legacy\.listCredentials\(\)\)/);
  assert.match(contextSource, /export const profileRequestScope = new AsyncLocalStorage<ProfileRequestContext>\(\)/);
});

test("#1144 credential inventory keeps Human BUZZ signer profile-owned and managed BUZZ service secrets Node-owned", async () => {
  const registry = JSON.parse(await readFile(new URL("../config/credential-boundary.registry.json", import.meta.url), "utf8"));
  const human = registry.credentials.find((item) => item.id === "buzz-connection");
  const node = registry.credentials.find((item) => item.id === "buzz-managed-runtime");
  assert.equal(human.owner_scope, "human-profile");
  assert.equal(human.protection, registry.encryption_contract.human_profile);
  assert.deepEqual(human.contains, ["privateKey"]);
  assert.equal(node.owner_scope, "node");
  assert.equal(node.protection, registry.encryption_contract.node);
  assert.ok(node.contains.includes("relayPrivateKey"));
});
