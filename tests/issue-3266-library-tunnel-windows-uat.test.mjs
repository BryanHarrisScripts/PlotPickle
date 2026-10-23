import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFile(path.join(root,p),"utf8");

test("#3266 nested Tunnel becomes a registered Settings child so the shared header is visible",async()=>{
  const [json,panel,host,css]=await Promise.all([
    read("config/skin-v1-surface-registry.json"),
    read("app/skin-v1/tunnel-settings-panel.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1-surface-orchestrator.css"),
  ]);
  const surfaces=JSON.parse(json).surfaces;
  const tunnel=surfaces.filter(s=>s.id==="tunnel");
  assert.equal(tunnel.length,1);
  assert.equal(tunnel[0].parent,"settings");
  assert.equal(tunnel[0].orchestrated,true);
  assert.equal(tunnel[0].runtimeSelector,"section[aria-label='Tunnel compute setup'][data-settings-tunnel-surface='true']");
  assert.equal(tunnel[0].runtimeReadySelector,"section[aria-label='Tunnel compute setup'] [data-settings-tunnel='owner-controlled']");
  assert.match(host,/aria-label="Tunnel compute setup" data-settings-tunnel-surface="true"/u);
  assert.match(host,/Back to Settings/u);
  assert.match(panel,/Back to Dashboard/u);
  assert.match(css,/pp-skin-v1-orchestrator-header/u);
});

test("#3266 Library LOAD uses actual full-browser width rather than nested 1180px shell",async()=>{
  const [css,library,host]=await Promise.all([
    read("app/skin-v1-surface-orchestrator.css"),
    read("modules/library/ui/library-workspace.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);
  assert.match(css,/data-skin-v1-active-surface\^="library"/u);
  assert.match(css,/data-skin-v1-surface-id\^="library"/u);
  assert.match(css,/max-width:\s*none\s*!important/u);
  assert.match(css,/calc\(100% - 40px\)/u);
  assert.match(css,/@media \(max-width: 560px\)/u);
  assert.match(library,/data-library-load-layout="posters-and-details"/u);
  assert.match(library,/data-library-surface="load"/u);
  assert.match(host,/data-dashboard-review-surface="library"/u);
});

test("#3266 every saved/packaged Library card can inspect its own film without switching project",async()=>{
  const [library,host,film,cardCss]=await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/continue-this-film.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);
  // One shared read-only inspector, many distinct per-story entry points.
  assert.equal((host.match(/<ContinueThisFilm/g)||[]).length,1);
  assert.match(library,/data-library-continue-story=\{item.id\}/u);
  assert.match(library,/data-library-continue-story=\{`example:/u);
  assert.match(library,/aria-label=\{`Continue This Film: /u);
  assert.match(library,/onInspect=\{\(\) => \{/u);
  assert.match(library,/onInspectStory\?\.\(entry.item.id\)/u);
  assert.match(library,/onInspectStory\?\.\(previewId/u);
  assert.match(library,/setInspectedStoryId\(entry.item.id\)/u);
  assert.match(library,/setInspectedExampleTitle\(null\)/u);
  assert.match(library,/loadLibraryProjectSnapshot\(inspectedSummary.id\)/u);
  assert.match(host,/selectedStoryId=\{inspectedFilm === null \? undefined : inspectedFilm.id\}/u);
  assert.match(host,/onInspectStory=\{\(id, exampleTitle\) => setInspectedFilm/u);
  assert.match(film,/const selectedId = selectedStoryId === undefined \? sessionActiveProjectId\(\) : selectedStoryId/u);
  assert.match(film,/project\.id !== selectedId/u);
  assert.match(film,/status: "EXAMPLE_NOT_OPEN"/u);
  assert.match(film,/selectedStoryId === sessionActiveProjectId\(\)/u);
  assert.match(film,/observed && isCurrentFilm && block !== null && onOpenOutline/u);
  assert.match(film,/profilePrivateBrowserReadyFor\(profileId\)/u);
  assert.match(film,/providerPolicy: "LOCAL_READ_ONLY"/u);
  assert.match(film,/No creative approval, Save & Lock/u);
  assert.doesNotMatch(film,/switchActiveLibraryProject\(|saveActiveLibraryProject\(|authenticatedComputeFetch\(|fetch\(/u);
  assert.match(cardCss,/\.continueStoryButton\[aria-pressed="true"\]/u);
});

test("#3266 occupied MCP port stays a safety interlock but offers actionable owner verification",async()=>{
  const [ui,backend]=await Promise.all([
    read("app/skin-v1/tunnel-settings-panel.tsx"),
    read("scripts/engineering-team/windows/tunnel/owner-tunnel-launch.mjs"),
  ]);
  assert.match(ui,/const occupied = status\?\.state === "LOCAL_MCP_PORT_OCCUPIED"/u);
  assert.match(ui,/disabled=\{busy \|\| !status\?\.launcherAvailable \|\| status.localMcpPortOccupied\}/u);
  assert.match(ui,/data-tunnel-existing-listener="unverified"/u);
  assert.match(ui,/This is not proof that the listener belongs to PlotPickle/u);
  assert.match(ui,/Recheck existing listener/u);
  assert.match(ui,/Ctrl\+C/u);
  assert.match(ui,/PLOTPICKLE TUNNEL READY/u);
  assert.match(backend,/if \(await portOccupied\(\)\) return \{ state: "BLOCKED", code: "LOCAL_MCP_PORT_OCCUPIED" \}/u);
  assert.doesNotMatch(ui,/Stop-Process|taskkill|kill\(|CONTROL_PLANE_API_KEY|type="password"/u);
});

test("#3266 all modified TSX components parse cleanly without a browser, still require actual Windows UAT",async()=>{
  const files=[
    "app/skin-v1/tunnel-settings-panel.tsx",
    "app/skin-v1/continue-this-film.tsx",
    "modules/library/ui/library-workspace.tsx",
    "app/skin-v1/dashboard-bbs-review-host.tsx",
  ];
  const output=await Promise.all(files.map(async p=>{
    const code=await read(p);
    return transform(code,{loader:"tsx",target:"es2022",format:"esm",sourcefile:p});
  }));
  assert.equal(output.length,files.length);
  assert.ok(output.every(result=>result.code.length>100));
});
