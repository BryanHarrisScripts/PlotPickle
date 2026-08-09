import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#529 puts Storyboard directing decisions before the visual preview", async () => {
  const actions = await source("app/creative-director-actions.tsx");
  const decisions = actions.indexOf('id="storyboard-decisions"');
  const preview = actions.indexOf('<figure className={styles.preview}>');

  assert.ok(decisions >= 0, "Storyboard decisions fieldset is missing");
  assert.ok(preview >= 0, "Storyboard preview is missing");
  assert.ok(decisions < preview, "Keep / Change / Compare must be encountered before the visual preview");
});

test("#529 keeps decision language visible even when no candidate exists", async () => {
  const actions = await source("app/creative-director-actions.tsx");
  const styles = await source("app/creative-director-actions.module.css");

  assert.match(actions, /Decide what happens to this visual/);
  assert.match(actions, /Keep what works, change the direction, try another version, or compare alternatives/);
  assert.match(actions, /Nothing becomes canon until you explicitly approve it/);
  assert.match(actions, /No approved visual yet/);
  assert.match(actions, /Use the choices above before generating anything/);

  assert.match(styles, /\.actionLegend\s*\{/);
  assert.doesNotMatch(styles, /\.actionLegend\s*\{[^}]*clip:/s);
  assert.doesNotMatch(styles, /\.actionLegend\s*\{[^}]*width:\s*1px/s);
});

test("#529 uses the locked matte-black and muted antique-gold visual language", async () => {
  const styles = await source("app/creative-director-actions.module.css");

  assert.match(styles, /#0b0b0a/);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /#e1ba64/i);
  assert.match(styles, /Courier New/);
  assert.match(styles, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test("#529 keeps provider and billing configuration out of directing decisions", async () => {
  const actions = await source("app/creative-director-actions.tsx");

  assert.doesNotMatch(actions, /Ollama|ComfyUI|MiniMax|API key|billing/i);
  assert.match(actions, /Open Settings/);
  assert.match(actions, /Nothing becomes approved until you explicitly choose Keep/);
});
