import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#2226 orchestrator visually replaces legacy shell and parent chrome", async () => {
  const [css, orchestrator] = await Promise.all([
    read("app/skin-v1-surface-orchestrator.css"),
    read("app/skin-v1/surface-orchestrator.tsx"),
  ]);

  assert.match(css, /nav\[data-plotpickle-global-nav="v4"\]/u);
  assert.match(css, /header\[data-matrix-preproduction-context="current"\]/u);
  assert.match(css, /> \.pp-skin-v1-return/u);
  assert.doesNotMatch(css, /\[data-library-back="directory"\]/u);
  assert.match(css, /\[data-skin-v1-local-chrome="decorative-title"\]/u);
  assert.match(css, /display: none !important/u);
  const suppressionStart = css.indexOf('.pp-skin-v1-orchestrator:not([data-skin-v1-active-surface="dashboard"])');
  const suppressionEnd = css.indexOf("/* Every active registered non-Dashboard surface", suppressionStart);
  const suppression = css.slice(suppressionStart, suppressionEnd);
  assert.match(suppression, /position:\s*absolute !important/u);
  assert.match(suppression, /width:\s*1px !important/u);
  assert.match(suppression, /height:\s*1px !important/u);
  assert.match(suppression, /clip-path:\s*inset\(50%\) !important/u);

  assert.match(orchestrator, /PREPRODUCTION_SURFACES/u);
  assert.match(orchestrator, /pp-skin-v1-orchestrator-workspace-header/u);
  assert.match(orchestrator, /pp-skin-v1-orchestrator-eyebrow/u);
  assert.match(orchestrator, />PRE-PRODUCTION</u);
  assert.match(orchestrator, /Block \$\{String\(block\)\.padStart\(2, "0"\)\}/u);
  assert.match(orchestrator, /Mini-Block \$\{mini\}/u);
});

test("#2226 directory surfaces mark decorative BBS titles as superseded chrome", async () => {
  const [library, storyMode] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("app/skin-v1/story-mode-host.tsx"),
  ]);

  assert.match(library, /data-skin-v1-local-chrome="decorative-title">\*\*\* LIBRARY DIRECTORY \*\*\*/u);
  assert.match(storyMode, /data-skin-v1-local-chrome="decorative-title">\*\*\* STORY MODE \*\*\*/u);
});

test("#2226 keeps legacy state handlers mounted while removing only their superseded presentation", async () => {
  const [library, storyMode, css] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("app/skin-v1/story-mode-host.tsx"),
    read("app/skin-v1-surface-orchestrator.css"),
  ]);

  assert.match(library, /function openActiveProject\(\)/u);
  assert.doesNotMatch(library, /data-library-back="directory"/u);
  assert.match(storyMode, /setView\("landing"\)/u);
  assert.doesNotMatch(css, /visibility:\s*hidden[^}]*data-library-back/u);
});
