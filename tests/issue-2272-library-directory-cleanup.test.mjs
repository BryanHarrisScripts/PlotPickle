import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2272 Library compact directory shows destination names without status dots", async () => {
  const [workspace, css, audit] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  assert.match(workspace, /data-skin-menu-indicators="hidden"/u);
  assert.match(workspace, /className=\{\`\$\{styles\.eyebrow\} \$\{styles\.libraryDirectoryEyebrow\}\`\}>Library directory<\/p>/u);
  assert.match(workspace, /aria-keyshortcuts=\{item\.shortcut\}/u);
  assert.match(workspace, /<span className=\{styles\.libraryDirectoryLabel\}>\{item\.label\}<\/span>/u);
  assert.doesNotMatch(workspace, /pp-skin-v1-dashboard-status-box/u);
  assert.doesNotMatch(workspace, /const command =/u);

  for (const label of ["NEW", "IMPORT", "LOAD", "EXAMPLES", "PRESETS", "AVERY", "ARCHIVE"]) {
    assert.ok(workspace.includes(`label: "${label}"`), `missing Library destination ${label}`);
  }

  assert.match(css, /\.libraryDirectoryMenu[\s\S]*grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\) !important/u);
  assert.match(css, /\.libraryDirectoryItem[\s\S]*justify-content:\s*center !important/u);
  assert.match(css, /\.libraryDirectoryLabel[\s\S]*white-space:\s*nowrap/u);
  assert.match(css, /\.libraryDirectoryEyebrow[\s\S]*color:\s*var\(--pp-skin-accent-bright\) !important/u);

  assert.match(audit, /indicatorsHidden:\s*scope\.getAttribute\("data-skin-menu-indicators"\) === "hidden"/u);
  assert.match(audit, /if \(!result\.indicatorsHidden\)/u);
});

test("#2272 Library compact directory uses two frame levels, not a third bright inner frame", async () => {
  const css = await read("modules/library/ui/library-workspace.module.css");

  assert.match(
    css,
    /\.libraryDirectory > :global\(\.pp-skin-v1-bbs\)[\s\S]*border:\s*var\(--pp-skin-border-thin\) solid var\(--pp-skin-line\) !important;[\s\S]*box-shadow:\s*none !important;/u,
  );
  assert.match(
    css,
    /\.libraryDirectoryMenu[\s\S]*border:\s*0 !important;[\s\S]*background:\s*var\(--pp-skin-accent-deep\) !important;[\s\S]*box-shadow:\s*none !important;/u,
  );
  assert.match(
    css,
    /\.libraryDirectoryItem[\s\S]*background:\s*var\(--pp-skin-accent-deep\) !important;/u,
  );
  assert.match(
    css,
    /\.libraryDirectoryItem\[aria-selected="true"\][\s\S]*border-color:\s*var\(--pp-skin-accent-bright\) !important;[\s\S]*background:\s*var\(--pp-skin-accent-deep\) !important;/u,
  );
});
