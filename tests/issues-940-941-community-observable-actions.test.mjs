import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #940 public-conversations Refresh leaves a settled observable completion status", async () => {
  const rail = await source("app/community-public-conversations-rail.tsx");

  for (const contract of [
    "Recent public conversations refreshed at",
    "new Date().toISOString()",
    "data-community-public-action-status",
    'role="status"',
    "refresh(true)",
  ]) {
    assert.ok(rail.includes(contract), `Public conversations rail is missing #940 contract: ${contract}`);
  }
});

test("issue #941 View all Great Hall conversations reports settled navigation even when Great Hall is already active", async () => {
  const rail = await source("app/community-public-conversations-rail.tsx");

  for (const contract of [
    "View all Great Hall conversations",
    "openGreatHallWithStatus",
    '[data-community-section="great-hall"]',
    'getAttribute("aria-current") === "page"',
    "Great Hall conversations opened at",
    "data-community-public-action-status",
    'role="status"',
  ]) {
    assert.ok(rail.includes(contract), `Public conversations rail is missing #941 contract: ${contract}`);
  }

  assert.doesNotMatch(rail, /className=\{styles\.viewAll\} onClick=\{openGreatHall\}/);
});
