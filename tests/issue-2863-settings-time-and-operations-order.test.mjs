import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../"+path,import.meta.url),"utf8");

test("Settings Operations lists Buzz, Agents, Data Recovery, Afterglow Recovery and Semantic UAT in B A D F U order", async()=>{
  const [ui,registryText,audit] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("config/skin-v1-surface-registry.json"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);
  const menu=ui.slice(ui.indexOf("const SETTINGS_MENU = ["),ui.indexOf("] as const;",ui.indexOf("const SETTINGS_MENU = [")));
  const operations=[["buzz-settings","B","Buzz"],["agents","A","Agents"],
    ["data-recovery","D","Data Recovery"],["afterglow-management","F","Afterglow Recovery"],
    ["semantic-uat","U","Semantic UAT"]];
  let previous=menu.indexOf('id: "hybrid"');
  for(const [id,shortcut,label] of operations){
    const i=menu.indexOf('id: "'+id+'"');
    assert.ok(i>previous,id+" must be after the previous operation");
    assert.match(menu.slice(i,menu.indexOf("\n",i)),new RegExp('label: "'+label+'"'));
    assert.ok(menu.slice(i,menu.indexOf("\n",i)).includes('group: "OPERATIONS"'));
    previous=i;
    assert.ok(ui.includes('"'+id+'": "'+shortcut+'"') || ui.includes(id+': "'+shortcut+'"'));
  }
  assert.match(audit,/G,I,M,L,C,H,B,A,D,F,U/u);
  assert.match(audit,/page\.keyboard\.press\("F"\)/u);
  const registry=JSON.parse(registryText);
  for(let i=0;i<operations.length;i++){
    const [id,,label]=operations[i];
    const surface=registry.surfaces.find(s=>s.id===id);
    assert.equal(surface.label,label);
    assert.equal(surface.parent,"settings");
    assert.equal(surface.navigationPath.at(-1).order,7+i);
  }
  assert.match(ui,/window\.location\.assign\("\/settings\/buzz"\)/u);
  assert.match(ui,/setPlotPickleAgentsOpen\(true\)/u);
});
test("Settings General renders OS-local time and zone without modifying saved timestamps or installing a conflicting clock setting", async()=>{
  const [general,settings]=await Promise.all([
    read("app/skin-v1/settings-workspace-panel.tsx"),
    read("lib/runtime/ai/settings.ts"),
  ]);
  assert.match(general,/Date &amp; Time/u);
  assert.match(general,/Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/u);
  assert.match(general,/dateStyle: "full", timeStyle: "short"/u);
  assert.match(general,/window\.setInterval\(update, 30_000\)/u);
  assert.match(general,/window\.clearInterval\(timer\)/u);
  assert.match(general,/Saved events use an unambiguous UTC timestamp/u);
  assert.match(general,/Changing the display time zone never alters the original saved instant/u);
  assert.doesNotMatch(settings,/timeZoneOverride|manualUtcOffset/u);
  assert.doesNotMatch(general,/new Date\(\)\.setHours\(/u);
});
test("UTC instant is invariant across Eastern daylight and standard time presentation",()=>{
  const fmt=new Intl.DateTimeFormat("en-US",{timeZone:"America/Toronto",hour:"2-digit",minute:"2-digit",hour12:false,timeZoneName:"short"});
  const summer=new Date("2026-10-09T13:29:00.000Z");
  const winter=new Date("2026-12-09T14:29:00.000Z");
  assert.equal(fmt.format(summer).replace(/\u202f/g," "),"09:29 EDT");
  assert.equal(fmt.format(winter).replace(/\u202f/g," "),"09:29 EST");
  assert.equal(summer.toISOString(),"2026-10-09T13:29:00.000Z");
  assert.equal(winter.toISOString(),"2026-12-09T14:29:00.000Z");
});
