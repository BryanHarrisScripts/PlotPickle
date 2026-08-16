import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#695 BUZZ live health belongs to the current dark Settings surface family", async () => {
  const [card, darkStyles] = await Promise.all([
    read("app/buzz-live-health-card.tsx"),
    read("app/buzz-live-health-card.module.css"),
  ]);

  assert.match(card, /buzz-live-health-card\.module\.css/);
  assert.match(card, /className=\{`\$\{styles\.statusCard\} \$\{liveStyles\.statusCard\}`\}/);
  assert.match(card, /className=\{`\$\{styles\.actions\} \$\{liveStyles\.actions\}`\}/);
  assert.match(card, /className=\{`\$\{styles\.statusBadge\} \$\{liveStyles\.statusBadge\}`\}/);

  assert.match(darkStyles, /\.statusCard \{[\s\S]*background: linear-gradient\(145deg, #111315, #0d1011\)/);
  assert.match(darkStyles, /\.actions \{[\s\S]*background: #0d1011/);
  assert.match(darkStyles, /\.statusBadge \{[\s\S]*background: #171a1c/);
  assert.match(darkStyles, /\.statusBadge\[data-state="connected"\][\s\S]*background: rgba\(53, 201, 184, 0\.12\)/);
  assert.doesNotMatch(darkStyles, /#ffffff|\bwhite\b/i);
});
