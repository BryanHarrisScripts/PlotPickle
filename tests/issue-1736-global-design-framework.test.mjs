import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validatePlotPickleScreenRegistry } from "../app/_components/plotpickle-system/contract.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1736 establishes one canonical visual-system owner and a bounded compatibility bridge", async () => {
  const [layout, css, registryText, guide, audit] = await Promise.all([
    read("app/layout.tsx"),
    read("app/_components/plotpickle-system/system.css"),
    read("app/_components/plotpickle-system/screen-registry.json"),
    read("app/_components/plotpickle-system/README.md"),
    read("scripts/ui-ux-code-audit.mjs"),
  ]);
  const registry = JSON.parse(registryText);

  assert.deepEqual(validatePlotPickleScreenRegistry(registry), []);
  assert.equal(registry.authoritativeStyle, "app/_components/plotpickle-system/system.css");
  assert.equal(registry.compatibilityBridge.ownerIssue, 1736);
  assert.ok(registry.compatibilityBridge.removalCondition.length > 40);
  assert.ok(layout.indexOf('import "./design-tokens.css"') < layout.indexOf('import "./globals.css"'));
  assert.match(await read("app/design-tokens.css"), /^@import "\.\/_components\/plotpickle-system\/system\.css";/u);
  const rules = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.doesNotMatch(rules, /!important|#[0-9a-f]{3,8}\b|rgba?\(/iu);
  assert.match(guide, /single adoption and locking authority/iu);
  assert.match(audit, /app\/_components\/plotpickle-system\/system\.css/u);
});

test("#1736 maps login/profile access onto bronze, jade and rune semantics without changing auth authority", async () => {
  const [css, profile, profileCss] = await Promise.all([
    read("app/_components/plotpickle-system/system.css"),
    read("app/profile-access/profile-access-boundary.tsx"),
    read("app/profile-access/profile-access-boundary.module.css"),
  ]);

  for (const role of ["canvas", "panel", "metal", "moss", "jade", "rune", "stone", "gilding", "focus"]) {
    assert.ok(css.includes(`--pp-system-${role}:`), `missing global semantic role ${role}`);
  }
  for (const alias of ["--pp-profile-night: var(--pp-system-canvas)", "--pp-profile-mystic: var(--pp-system-panel)", "--pp-profile-juniper: var(--pp-system-jade)", "--pp-profile-status: var(--pp-system-rune)"]) {
    assert.ok(css.includes(alias), `profile access has not adopted ${alias}`);
  }
  for (const authority of ["profileRequest(\"login\"", "X-PlotPickle-CSRF", "hydrateProfilePrivateBrowser", "flushProfilePrivateWrites", "clearPrivateScreen"]) {
    assert.ok(profile.includes(authority), `profile authority changed or disappeared: ${authority}`);
  }
  assert.match(profileCss, /\.card::before\s*\{[\s\S]*color:\s*var\(--pp-system-metal\)/u);
  assert.match(profileCss, /\.activeHuman\s*\{[\s\S]*color:\s*var\(--pp-system-text\)/u);
});

test("#1736 gives profile access a reusable SVG Salt Compass gateway without flattening live content", async () => {
  const [profile, profileCss, chamber, panel] = await Promise.all([
    read("app/profile-access/profile-access-boundary.tsx"),
    read("app/profile-access/profile-access-boundary.module.css"),
    read("public/assets/plotpickle-system/login-chamber.svg"),
    read("public/assets/plotpickle-system/login-panel-frame.svg"),
  ]);

  assert.match(profileCss, /plotpickle-system\/login-chamber\.svg/u);
  assert.match(profileCss, /plotpickle-system\/login-panel-frame\.svg/u);
  assert.match(chamber, /viewBox="0 0 1920 1080"[\s\S]*id="bronze"[\s\S]*id="jade"[\s\S]*ᚠ/u);
  assert.match(panel, /viewBox="0 0 820 860"[\s\S]*id="metal"[\s\S]*id="gem"[\s\S]*ᚷ/u);
  assert.match(profile, /<form onSubmit=\{signIn\}>[\s\S]*<PasswordField[\s\S]*Unlock profile/u);
  assert.doesNotMatch(chamber + panel, /<foreignObject|<script/u);
});

test("#1736 captures the full story-building journey while keeping visibility separate from canon editing", async () => {
  const registry = JSON.parse(await read("app/_components/plotpickle-system/screen-registry.json"));
  const byId = new Map(registry.screens.map((screen) => [screen.id, screen]));

  for (const id of ["profile-access", "global-shell", "dashboard", "learn", "plan", "build", "storyboard", "previs", "write", "edit", "feedback", "refine", "reports", "community", "wyrmwood", "settings"]) {
    assert.ok(byId.has(id), `story-building surface is missing from the migration registry: ${id}`);
  }
  assert.equal(byId.get("profile-access").maturity, "adopting");
  assert.equal(byId.get("global-shell").maturity, "approved");
  assert.equal(byId.get("storyboard").discoverable, true);
  assert.equal(byId.get("storyboard").canonEditable, false);
  assert.equal(registry.screens.some((screen) => screen.maturity === "locked"), false, "unfinished screens must not be locked prematurely");
});

test("#1736 refuses an unsupported maturity or an unevidenced visual lock", async () => {
  const registry = JSON.parse(await read("app/_components/plotpickle-system/screen-registry.json"));
  const invalidMaturity = structuredClone(registry);
  invalidMaturity.screens[0].maturity = "finished";
  assert.ok(validatePlotPickleScreenRegistry(invalidMaturity).some((failure) => failure.includes("invalid maturity")));

  const unevidencedLock = structuredClone(registry);
  unevidencedLock.screens[0].maturity = "locked";
  assert.ok(validatePlotPickleScreenRegistry(unevidencedLock).some((failure) => failure.includes("locked without lockedByIssue")));
});
