import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the home PlotPickle.ps1 installer preserves the old file and installs the update-first bootstrap", async () => {
  const [installer, bootstrap, guide] = await Promise.all([
    read("Utilities/Install-PlotPickle-HomeLauncher.ps1"),
    read("GIT-PlotPickle.ps1"),
    read("docs/developer-briefs/1960-home-launcher-bootstrap.md"),
  ]);
  assert.match(installer, /Join-Path \$HOME "PlotPickle\.ps1"/u);
  assert.match(installer, /Copy-Item -LiteralPath \$homeLauncher -Destination \$backup/u);
  assert.match(installer, /Copy-Item -LiteralPath \$bootstrap -Destination \$homeLauncher -Force/u);
  assert.match(bootstrap, /Set-Location -LiteralPath \$repoPath[\s\S]*& \$git\.Source pull --ff-only[\s\S]*& \$repoLauncher @launchArgs/u);
  assert.match(guide, /Install-PlotPickle-HomeLauncher\.ps1/u);
  assert.match(guide, /\.\\PlotPickle\.ps1/u);
});
