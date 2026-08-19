import "./issue-1106-painterly-agent-portraits.test.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("#1064 remains historical and no longer owns product-facing avatar direction", () => {
  const helperDirectory = readFileSync(resolve(root, "config/helper-directory.json"), "utf8");
  const portraitRegistry = readFileSync(resolve(root, "lib/agent-portrait-registry.ts"), "utf8");
  assert.doesNotMatch(helperDirectory, /\/assets\/helpers\/16bit\//i);
  assert.match(portraitRegistry, /painterly|fantasy portrait/i);
});
