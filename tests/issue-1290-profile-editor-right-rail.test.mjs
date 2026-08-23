import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

test("#1290 keeps the left Human identity summary read-only and moves presentation editing into the right rail", async () => {
  const panel = await read("app/profile-access/profile-identity-panel.tsx");
  const identityStart = panel.indexOf('<section className={styles.identityColumn}');
  const rightRailStart = panel.indexOf('<aside className={styles.rightRail}');
  const identity = panel.slice(identityStart, rightRailStart);
  const rightRail = panel.slice(rightRailStart);

  assert.ok(identityStart >= 0 && rightRailStart > identityStart);
  assert.match(identity, /Human Profile/u);
  assert.match(identity, /BUZZ Identity/u);
  assert.doesNotMatch(identity, /className=\{styles\.identityForm\}|<span>Display name \(agent name\)<\/span>|<span>Display Description<\/span>|<span>Lore Avatar prompt<\/span>|Save Profile/u);

  assert.match(rightRail, /Profile editor/u);
  assert.match(rightRail, /Current profile avatar/u);
  assert.match(rightRail, /<span>Display name \(agent name\)<\/span>/u);
  assert.match(rightRail, /<span>Display Description<\/span>/u);
  assert.doesNotMatch(rightRail, /<span>Avatar<\/span>/u);
  assert.match(rightRail, /<span>Lore Avatar prompt<\/span>/u);
  assert.match(rightRail, /Generate Lore Avatar/u);
  assert.match(rightRail, /Save Profile/u);

  const editorIndex = rightRail.indexOf("Profile editor");
  const accessIndex = rightRail.indexOf("Access");
  const actionsIndex = rightRail.indexOf("Profile actions");
  assert.ok(editorIndex >= 0 && accessIndex > editorIndex && actionsIndex > accessIndex);
});

test("#1290 gives the editor a stable unclipped rail and stacks summary, editor, Access and actions on narrow screens", async () => {
  const css = await read("app/profile-access/profile-identity-panel.module.css");

  assert.match(css, /grid-template-columns:\s*minmax\(0, 1\.7fr\) minmax\(260px, 0\.72fr\)/u);
  assert.match(css, /\.rightRail\s*\{[\s\S]*min-width:\s*0;[\s\S]*display:\s*grid;[\s\S]*align-content:\s*start;/u);
  assert.match(css, /\.editorCard,\s*\.actionColumn\s*\{[\s\S]*min-width:\s*0;/u);
  assert.match(css, /\.identityForm\s*\{[\s\S]*width:\s*100%;/u);
  assert.match(css, /box-sizing:\s*border-box/u);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.profileColumns\s*\{[\s\S]*grid-template-columns:\s*1fr;[\s\S]*\.rightRail\s*\{[\s\S]*grid-column:\s*1;/u);
});

test("#1290 preserves the canonical local-first save and private generated-avatar BUZZ boundary", async () => {
  const panel = await read("app/profile-access/profile-identity-panel.tsx");
  const saveStart = panel.indexOf("async function savePresentation");
  const saveEnd = panel.indexOf("async function generateLoreAvatar");
  const save = panel.slice(saveStart, saveEnd);

  assert.ok(saveStart >= 0 && saveEnd > saveStart);
  assert.ok(save.indexOf("saveLocalPresentation(presentation)") < save.indexOf("publishToBuzz(result.profile)"));
  assert.match(save, /local Profile was not rolled back/u);
  assert.match(save, /isPlotPickleGeneratedAvatarRef\(result\.profile\.avatarUrl\)/u);
  assert.match(panel, /\/api\/auth\/profile-presentation/u);
  assert.doesNotMatch(panel, /second presentation|profile-presentation-v2/u);
});
