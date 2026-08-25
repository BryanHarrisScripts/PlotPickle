import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1225 describes the local profile and optional external data flows accurately", async () => {
  const [privacy, profile, connections, providers] = await Promise.all([
    source("PRIVACY.md"),
    source("app/profile-access/profile-access-boundary.tsx"),
    source("lib/integrations/connection-status.ts"),
    source("app/settings/ai-provider/ai-provider-setup-panel.tsx"),
  ]);

  assert.match(privacy, /does not require an email address, phone number, PlotPickle cloud account/);
  assert.match(profile, /No email, phone, cloud account, Internet connection, BUZZ identity, GitHub, or Google login is required/);
  for (const destination of ["BUZZ Community", "Cloud or remote AI provider", "GitHub", "Google", "Manual export or prompt copy"]) {
    assert.ok(privacy.includes(`| ${destination} |`), `Privacy Notice is missing ${destination}`);
  }
  assert.match(privacy, /does not silently replace a failed local route with a paid cloud request/);
  assert.match(connections, /Only the story context explicitly selected for an AI request/);
  assert.match(providers, /PlotPickle never silently falls back to a paid route/);
});

test("#1225 distinguishes Community story discussion from real-world harm and states Merrin's limits", async () => {
  const [guidelines, policy, moderationTest] = await Promise.all([
    source("COMMUNITY_GUIDELINES.md"),
    source("config/buzz-guildhall-community.json").then(JSON.parse),
    source("tests/issue-1081-merrin-room-aware-moderation.test.mjs"),
  ]);

  assert.match(guidelines, /A sensitive word or difficult fictional event is not misconduct by itself/);
  assert.match(guidelines, /Real-world sourcing, trafficking, preparation instructions/);
  assert.match(guidelines, /Merrin cannot silently delete messages, ban or block members/);
  assert.match(guidelines, /does not promise a particular response time, removal result, appeal system, or emergency service/);
  assert.equal(policy.moderationPolicy.fictionalSensitiveContentAllowed, true);
  assert.equal(policy.moderationPolicy.hardEnforcement, false);
  assert.match(moderationTest, /denies hard moderation authority/);
});

test("#1225 keeps ownership qualified and avoids unsupported hosted-service claims", async () => {
  const [legal, scope, ownership, notice, collaboration] = await Promise.all([
    source("app/legal/page.tsx"),
    source("LICENSES.md"),
    source("docs/licensing-and-ownership.md"),
    source("NOTICE.md"),
    source("public/docs/readme/COLLABORATION-AND-DEVELOPMENT.md"),
  ]);

  for (const text of [legal, scope, ownership, notice]) assert.match(text, /AI-assisted output/);
  assert.match(legal, /does not provide a hosted PlotPickle SaaS/);
  assert.match(ownership, /does not promise compatibility with a particular hosting control panel or CMS/);
  assert.match(collaboration, /does not promise compatibility with a particular hosting control panel or CMS/);
  for (const text of [legal, ownership, collaboration]) assert.doesNotMatch(text, /Plesk|WordPress/);
});

test("#1225 makes policy files and dependency licence metadata part of public readiness", async () => {
  const [audit, packageJson, packageLock] = await Promise.all([
    source("scripts/public-readiness.mjs"),
    source("package.json").then(JSON.parse),
    source("package-lock.json").then(JSON.parse),
  ]);

  assert.match(audit, /"PRIVACY\.md"/);
  assert.match(audit, /"COMMUNITY_GUIDELINES\.md"/);
  for (const dependency of [...Object.keys(packageJson.dependencies || {}), ...Object.keys(packageJson.devDependencies || {})]) {
    const record = packageLock.packages?.[`node_modules/${dependency}`];
    assert.ok(record, `${dependency} is missing from package-lock.json`);
    assert.equal(typeof record.license, "string", `${dependency} has no licence metadata`);
  }
});
