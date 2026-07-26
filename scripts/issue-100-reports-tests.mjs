import { readFileSync, writeFileSync } from "node:fs";

function replace(path, before, after) {
  const source = readFileSync(path, "utf8");
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  writeFileSync(path, source.replace(before, after));
}

function append(path, marker, content) {
  const source = readFileSync(path, "utf8");
  if (!source.includes(marker)) writeFileSync(path, `${source.trimEnd()}\n\n${content.trim()}\n`);
}

replace("app/settings-project-tools.tsx", `<div className={styles.roleTabs} role="tablist" aria-label="Industry reports"><button type="button" role="tab" aria-selected={reportView === "producer"} className={reportView === "producer" ? styles.active : ""} onClick={() => setReportView("producer")}><strong>Producer</strong><span>Scale, readiness, schedule and blockers</span></button><button type="button" role="tab" aria-selected={reportView === "actor"} className={reportView === "actor" ? styles.active : ""} onClick={() => setReportView("actor")}><strong>Actor</strong><span>Dialogue, words, scenes and speaking time</span></button><button type="button" role="tab" aria-selected={reportView === "director"} className={reportView === "director" ? styles.active : ""} onClick={() => setReportView("director")}><strong>Director</strong><span>Scene intention, cast, coverage and runtime</span></button></div>

      <div className={styles.summaryGrid}>`, `<div className={styles.reportLayout}>
        <nav className={styles.roleTabs} aria-label="Report sections"><button type="button" aria-current={reportView === "producer" ? "page" : undefined} className={reportView === "producer" ? styles.active : ""} onClick={() => setReportView("producer")}><strong>Producer</strong><span>Scale, readiness, schedule and blockers</span></button><button type="button" aria-current={reportView === "actor" ? "page" : undefined} className={reportView === "actor" ? styles.active : ""} onClick={() => setReportView("actor")}><strong>Actor</strong><span>Dialogue, words, scenes and speaking time</span></button><button type="button" aria-current={reportView === "director" ? "page" : undefined} className={reportView === "director" ? styles.active : ""} onClick={() => setReportView("director")}><strong>Director</strong><span>Scene intention, cast, coverage and runtime</span></button></nav>
        <div className={styles.reportContent}>
      <div className={styles.summaryGrid}>`);
replace("app/settings-project-tools.tsx", `      </> : null}
    </>
  );
}

export function TerminologyIndex`, `      </> : null}
        </div>
      </div>
    </>
  );
}

export function TerminologyIndex`);
append("app/settings-project-tools.module.css", ".reportLayout{display:grid", `.reportLayout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;align-items:start}.reportContent{min-width:0}.reportLayout .roleTabs{position:sticky;top:156px;display:grid;grid-template-columns:1fr;gap:8px;align-self:start;margin:0}.reportLayout .roleTabs button{min-height:84px}.reportLayout .roleTabs .active{box-shadow:inset 4px 0 0 #2d8a79}@media(max-width:900px){.reportLayout{grid-template-columns:1fr}.reportLayout .roleTabs{position:static;grid-template-columns:repeat(3,minmax(0,1fr))}.reportLayout .roleTabs .active{box-shadow:inset 0 -4px 0 #2d8a79}}@media(max-width:600px){.reportLayout .roleTabs{grid-template-columns:1fr}}`);

replace("tests/issue-87-navigation-cleanup.test.mjs", `test("issue #87 opens the Dashboard directly and keeps Simple Start optional", async () => {`, `test("issue #87 keeps Dashboard ready behind the startup splash and Simple Start optional", async () => {`);
replace("tests/issue-87-navigation-cleanup.test.mjs", `  assert.match(page, /useState\(false\)/);`, `  assert.match(page, /useState\(true\)/);`);

replace("tests/issue-63-new-writer-path.test.mjs", `const middleware = read("middleware.ts");`, `const middleware = read("middleware.ts");\nconst main = read("app/page.tsx");`);
replace("tests/issue-63-new-writer-path.test.mjs", `test("the root opens the core workspace while Welcome remains optional", () => {`, `test("the root opens the updated splash while Welcome remains an optional guided route", () => {`);
replace("tests/issue-63-new-writer-path.test.mjs", `  assert.match(welcome, /Simple Start · optional guided entry/);`, `  assert.match(main, /const \[showLanding, setShowLanding\] = useState\(true\)/);\n  assert.match(welcome, /Simple Start · optional guided entry/);`);

replace("tests/proposed-primary-menu.test.mjs", `test("the application renders the shared menu and opens on Dashboard", async () => {`, `test("the application renders the shared menu with Dashboard ready behind the splash", async () => {`);
replace("tests/proposed-primary-menu.test.mjs", `  assert.match(page, /useState<MainTab>\("dashboard"\)/);`, `  assert.match(page, /useState<MainTab>\("dashboard"\)/);\n  assert.match(page, /const \[showLanding, setShowLanding\] = useState\(true\)/);`);
replace("tests/proposed-primary-menu.test.mjs", `  const css = await source("app/ui-ux-cleanup.css");
  assert.match(css, /Proposed simplified primary menu/);
  assert.match(css, /grid-template-columns: minmax\(220px, 0\.9fr\) minmax\(0, 4fr\)/);
  assert.match(css, /min-height: 64px/);`, `  const css = await source("app/premium-ui.css");\n  assert.match(css, /grid-template-columns:minmax\(190px,1fr\) auto minmax\(190px,1fr\)/);\n  assert.match(css, /\.main-tabs\{justify-self:center/);\n  assert.match(css, /min-height:70px/);`);

replace("package.json", `tests/proposed-primary-menu.test.mjs tests/phase-one-core-schema.test.mjs`, `tests/proposed-primary-menu.test.mjs tests/issue-100-premium-ui-ux.test.mjs tests/phase-one-core-schema.test.mjs`);
replace("package.json", `    "test:primary-menu": "node --test tests/proposed-primary-menu.test.mjs"`, `    "test:primary-menu": "node --test tests/proposed-primary-menu.test.mjs",\n    "test:premium-ui": "node --test tests/issue-100-premium-ui-ux.test.mjs"`);

console.log("Issue #100 reports and tests migration applied.");
