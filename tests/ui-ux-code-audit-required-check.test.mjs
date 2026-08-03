import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const checkName = "Audit UI/UX against Design Rules";

test("UI audit check name is identical in workflow and branch rules", async () => {
  const workflow = await text(".github/workflows/ui-ux-code-audit.yml");
  const settings = JSON.parse(await text("config/public-repository.settings.json"));
  assert.match(workflow, new RegExp(`name: ${checkName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.ok(settings.main_branch.required_checks.includes(checkName));
});
