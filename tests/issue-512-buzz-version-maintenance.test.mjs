import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const installer = await readFile(new URL("../scripts/install-buzz-desktop.ps1", import.meta.url), "utf8");

test("Buzz maintenance compares semantic versions instead of treating every mismatch as an update", () => {
  assert.match(installer, /function Compare-BuzzVersion/);
  assert.match(installer, /Compare-BuzzVersion -Installed \$installedVersion -Reviewed \$version/);
  assert.doesNotMatch(installer, /\$installedVersion -ne \$version/);
});

test("newer installed Buzz versions are retained and never replaced by the pinned reviewed package", () => {
  assert.match(installer, /\$comparison -gt 0/);
  assert.match(installer, /newer than PlotPickle's reviewed package/i);
  assert.match(installer, /Keeping the installed version and skipping the pinned installer/i);
  assert.match(installer, /Write-PlotPickleBuzzStatus -Status "detected"/);
});

test("Buzz installer runs only when the installed version is actually older", () => {
  assert.match(installer, /\$updateRequired = \$Maintain -and \$installedVersion -and \$null -ne \$comparison -and \$comparison -lt 0/);
  assert.match(installer, /\[UPDATE\] Buzz Desktop \$installedVersion is installed; PlotPickle's reviewed package is \$version/);
});
