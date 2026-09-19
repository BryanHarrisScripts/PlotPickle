import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2266 keeps Library destinations in one persistent shell", async () => {
  const [source, css] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);

  for (const destination of ["new", "import", "examples", "presets", "avery", "archive"]) {
    assert.match(source, new RegExp(`id: "${destination}"`, "u"));
  }
  assert.match(source, /data-library-directory="keyboard-directory"/u);
  assert.match(source, /destination !== null \? \(/u);
  assert.doesNotMatch(source, /data-library-back="directory"/u);
  assert.match(css, /\.libraryDirectoryMenu[\s\S]*grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\)/u);
});

test("#2266 puts Pre-Production Story Bible directly before Outline", async () => {
  const [menu, panel, host, bible] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
  ]);

  const storyBible = menu.indexOf('id: "story-bible"');
  const outline = menu.indexOf('id: "plan"');
  assert.ok(storyBible >= 0 && outline > storyBible);
  assert.match(menu, /label: "Pre-Production"[\s\S]*description: "Story Bible, Logline, Theme and Visual Reference"/u);
  assert.doesNotMatch(panel, /write-story-bible|story-bible-companion/u);
  assert.match(host, /PRE-PRODUCTION \/ STORY BIBLE/u);
  assert.match(bible, /data-pre-production-surface="story-bible"/u);
  assert.match(bible, /<Fact fact=\{bible\.logline\}/u);
  assert.match(bible, /<Fact fact=\{bible\.theme\}/u);
  assert.doesNotMatch(bible, /mistakes/iu);
});

test("#2266 keeps the universal microphone attached to a visible field", async () => {
  const voice = await read("app/_components/universal-voice-input-layer.tsx");
  assert.match(voice, /const fieldVisible = rect\.bottom > 0/u);
  assert.match(voice, /if \(!fieldVisible\)[\s\S]*setPosition\(null\)/u);
  assert.match(voice, /top: rect\.top \+ 6/u);
  assert.doesNotMatch(voice, /Math\.max\(6, Math\.min\(window\.innerHeight - 44, rect\.top \+ 6\)\)/u);
});

test("#2266 generates Display Description before final profile save", async () => {
  const [profile, css, skinCss] = await Promise.all([
    read("app/profile-access/profile-identity-panel.tsx"),
    read("app/profile-access/profile-identity-panel.module.css"),
    read("app/skin-v1-settings-directory.css"),
  ]);

  assert.match(profile, /Generate Display Description/u);
  assert.match(profile, /Describe your character/u);
  assert.match(profile, /\/api\/writing-assistant\/chat/u);
  assert.match(profile, /data-generated-display-description="true"/u);
  assert.match(profile, /readOnly aria-readonly="true"/u);
  assert.ok(profile.indexOf("Generate Display Description") < profile.indexOf('type="submit"'));
  assert.match(profile, /const buzzConnected = connected \|\| identityConfigured/u);
  assert.match(css, /data-generated-display-description/u);
  assert.match(skinCss, /Profile readiness[\s\S]*display:\s*flex !important/u);
});

test("#2266 applies the bounded visual conformance fixes", async () => {
  const [writerCss, continuityCss, loginCss, settingsCss] = await Promise.all([
    read("app/skin-v1/learn-journey-preview.module.css"),
    read("app/workspace-continuity.css"),
    read("app/profile-access/profile-access-boundary.module.css"),
    read("app/skin-v1-settings-directory.css"),
  ]);

  assert.doesNotMatch(writerCss, /var\(--pp-skin-line-strong\)/u);
  assert.match(writerCss, /var\(--pp-skin-accent\)/u);
  assert.match(continuityCss, /overflow:\s*hidden;[\s\S]*isolation:\s*isolate;[\s\S]*border:\s*1px solid rgba\(54, 217, 194, 0\.36\)/u);
  assert.match(loginCss, /#2266 Skin V1 profile gate alignment/u);
  assert.match(loginCss, /html\[data-plotpickle-skin="skin-v1"\][\s\S]*var\(--pp-skin-accent\)/u);
  assert.match(settingsCss, /width:\s*min\(var\(--pp-skin-shell-max\), 100%\) !important/u);
});
