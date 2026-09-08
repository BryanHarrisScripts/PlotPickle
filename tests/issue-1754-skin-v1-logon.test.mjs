import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

async function missing(relative) {
  await assert.rejects(access(path.join(root, relative)));
}

test("#1754 names the existing UI Legacy Skin and starts the new architecture at Skin V1", async () => {
  const [runtime, layout, css] = await Promise.all([
    read("app/skin-v1-runtime.tsx"),
    read("app/layout.tsx"),
    read("app/skin-v1.css"),
  ]);

  assert.match(runtime, /SKIN_V1 = "skin-v1"/u);
  assert.match(runtime, /pathname === "\/skin-v1"/u);
  assert.match(runtime, /window\.location\.replace\("\/skin-v1"\)/u);
  assert.match(layout, /<SkinV1Runtime \/>/u);
  assert.match(layout, /<LegacyDemoBoundary>/u);
  assert.match(layout, /<ProfileAccessRouter>/u);
  assert.match(layout, /<LegacySkinOnly>/u);
  assert.match(css, /data-plotpickle-skin="skin-v1"/u);
  assert.match(css, /#000/u);
  assert.match(css, /#fff/u);
  await missing("app/v2/page.tsx");
  await missing("app/barebones-skin-runtime.tsx");
});

test("#1754 LOGON is a headless Business Use Case with ephemeral credentials", async () => {
  const [contract, useCase, gateway, registry] = await Promise.all([
    read("core/contracts/experience.ts"),
    read("lib/experience/logon-use-case.ts"),
    read("adapters/experience/browser-profile-auth-gateway.ts"),
    read("lib/experience/surface-registry.ts"),
  ]);

  assert.match(contract, /type: "AuthenticateHuman"/u);
  assert.match(contract, /locator: string/u);
  assert.doesNotMatch(contract, /password|passphrase|credential/u);

  assert.match(useCase, /ExperienceAuthGateway/u);
  assert.match(useCase, /executeAuthenticateHumanIntent/u);
  assert.match(useCase, /projectLogonViewModel/u);
  assert.match(useCase, /PROFILE_LOCATOR_REQUIRED/u);
  assert.match(useCase, /PROFILE_CREDENTIAL_REQUIRED/u);
  assert.doesNotMatch(useCase, /fetch\(|window\.|document\.|react/u);

  assert.match(gateway, /fetch\("\/api\/auth\/profile"/u);
  assert.match(gateway, /hydrateProfilePrivateBrowser/u);
  assert.match(gateway, /migrateLegacyBrowserProjects/u);
  assert.match(gateway, /password: credential/u);

  assert.match(registry, /authenticated \? "HOME" : "LOGON"/u);
  assert.match(registry, /NOT_MIGRATED_TO_HEADLESS_EXPERIENCE/u);
  assert.doesNotMatch(registry, /react|window\.|document\.|fetch\(/i);
});

test("#1754 Skin V1 emits LOGON intent and renders only LOGON or blank HOME", async () => {
  const [skin, router, legacyOnly] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/profile-access/profile-access-router.tsx"),
    read("app/legacy-skin-only.tsx"),
  ]);

  assert.match(skin, /type: "AuthenticateHuman"/u);
  assert.match(skin, /executeAuthenticateHumanIntent/u);
  assert.match(skin, /deriveExperienceSurfaceTopology/u);
  assert.match(skin, /data-experience-surface="LOGON"/u);
  assert.match(skin, /aria-label="PlotPickle Home"/u);
  assert.match(skin, />HOME</u);
  assert.doesNotMatch(skin, /fetch\(|\/api\/auth\/profile|hydrateProfilePrivateBrowser|saveFoundationProject/u);

  assert.match(router, /isSkinV1Path/u);
  assert.match(router, /return <>{children}<\/>/u);
  assert.match(legacyOnly, /if \(skinV1\(pathname\)\) return null/u);
});
