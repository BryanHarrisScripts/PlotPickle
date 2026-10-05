import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('#2751 General and Operations have distinct canonical panels and keyboard destinations',async()=>{
  const settings=await read('app/skin-v1/settings-workspace-panel.tsx');
  const menu=await read('app/skin-v1/dashboard-bbs-panel.tsx');
  const general=settings.slice(settings.indexOf('  const startupPage ='));
  assert.doesNotMatch(general,/<UatGuidePanel/u);
  assert.match(general,/content="source"/u);
  assert.match(general,/<SystemMathematicsCard/u);
  assert.match(settings,/section === "semantic-uat" \? <UatGuidePanel \/> : <SettingsReviewSystemPanel[^\n]*content="recovery"/u);
  for(const [id,label] of [['semantic-uat','Semantic UAT'],['data-recovery','Data Recovery']]){
    assert.match(menu,new RegExp(`id: "${id}"[^\\n]*label: "${label}"[^\\n]*group: "OPERATIONS"`,'u'));
  }
  const registry=JSON.parse(await read('config/skin-v1-surface-registry.json'));
  for(const id of ['semantic-uat','data-recovery']) {
    const surface=registry.surfaces.find(row=>row.id===id);
    assert.equal(surface.parent,'settings');
    assert.ok(surface.runtimeReadySelector.includes(id));
    assert.ok((await read('lib/verification/webmcp-surface-capture-registry.mjs')).includes(`id: "${id}"`));
  }
  assert.match(await read('lib/verification/webmcp-surface-visual-audit.mjs'),/settingsRows.length === 11 && settingsRows.every/u);
  assert.match(menu,/onSurfaceNameChange\(WORKSPACE_SETTINGS_LABELS\[settingsWorkspace\]\.toUpperCase\(\)\)/u);
  assert.match(menu,/setSettingsWorkspace\(null\)/u);
  assert.match(await read('app/skin-v1/uat-guide-panel.tsx'),/<h2 id="uat-review-title">Semantic UAT<\/h2>/u);
});

test('#2751 source-only General does not fetch or render recovery storage',async()=>{
  const source=await read('app/skin-v1/settings-review-system-panel.tsx');
  assert.match(source,/if \(contentMode === "source"\) return;[\s\S]*window\.setTimeout/u);
  assert.match(source,/contentMode !== "source" \? <article[^\n]*advanced-data/u);
  assert.match(source,/<h3>Data Recovery<\/h3>/u);
  for(const endpoint of ['/api/local-projects/status','/api/local-projects/library','/api/local-projects/backups'])assert.ok(source.includes(endpoint));
  assert.match(source,/restore operations still require the active project context and explicit Human confirmation/u);
});

test('#2751 supplied mathematics preserves every unit, section order and independent totals',async()=>{
  const source=await read('app/_components/settings/system-mathematics-card.tsx');
  const rows=JSON.parse(source.match(/SYSTEM_MATHEMATICS = ([\s\S]*?) as const;/u)[1]);
  assert.deepEqual(rows.map(r=>r.title),['1 Act','1 Block','1 Mini-Block','1 Sequence','1 Shot','Complete movie — 4 Acts']);
  const shotsPerMini=25,secondsPerShot=3,fps=24;
  for(const [index,minis] of [[0,24],[1,4],[2,1],[3,8]]){
    const frames=minis*shotsPerMini*secondsPerShot*fps;
    assert.ok(rows[index].lines.some(l=>l.startsWith(`= ${frames.toLocaleString('en-US')} final video frames`)));
  }
  const movie=rows[5].lines.join('\n');
  const shots=4*6*4*shotsPerMini,seconds=shots*secondsPerShot;
  assert.equal(seconds/60,120);
  assert.ok(movie.includes(`= ${shots.toLocaleString('en-US')} Shots`));
  assert.ok(movie.includes(`= ${(seconds*fps).toLocaleString('en-US')} final video frames`));
  assert.match(source,/actual video frame counts depend on the rendered shot durations and export frame rate/u);
  assert.match(source,/A storyboard shot is a planned shot/u);
  assert.equal(rows.reduce((n,r)=>n+r.lines.length,0),31);
});
