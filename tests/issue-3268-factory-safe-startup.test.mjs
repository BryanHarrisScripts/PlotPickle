import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assessFactoryStartupBoundary} from
  '../scripts/engineering-team/windows/launcher/factory-startup-guard.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const script=async name=>readFile(path.join(root,name),'utf8');

test('active supervisor stops launcher updates without attempting port takeover',async()=>{
  let probes=0;
  const r=await assessFactoryStartupBoundary({
    supervisor:async()=>({state:'RUNNING',exactSha:'a'.repeat(40)}),
    probe:async()=>{probes++;return 'FREE';}
  });
  assert.equal(r.protectedRuntime,true);
  assert.equal(r.sourceUpdateAllowed,false);
  assert.equal(r.sharedRuntimeMutationAllowed,false);
  assert.equal(r.mustNotStopForeignProcess,true);
  assert.equal(probes,0);
});
test('stale, paused, STOP and unreadable supervisor are all fail-closed',async()=>{
  for(const value of ['OFFLINE','PAUSED','STOP_REQUESTED','BLOCKED','RUNNING']){
    const r=await assessFactoryStartupBoundary({supervisor:async()=>({state:value})});
    assert.equal(r.protectedRuntime,true,value);
  }
  const r=await assessFactoryStartupBoundary({supervisor:async()=>{throw Error('broken');}});
  assert.equal(r.code,'SUPERVISOR_INSPECTION_UNVERIFIABLE');
  assert.equal(r.protectedRuntime,true);
});
test('separate Factory port and tunnel are individually protected',async()=>{
  for(const occupied of [4174,43115]){
    const calls=[];
    const r=await assessFactoryStartupBoundary({
      supervisor:async()=>({state:'OFF'}),
      probe:async p=>{calls.push(p.port);return p.port===occupied?'OCCUPIED':'FREE';},
    });
    assert.equal(r.code,'FACTORY_ENDPOINT_IN_USE');
    assert.equal(r.protectedRuntime,true);
    assert.ok(calls.includes(occupied));
  }
  const unknown=await assessFactoryStartupBoundary({
    supervisor:async()=>({state:'OFF'}),probe:async()=> 'UNKNOWN'
  });
  assert.equal(unknown.code,'FACTORY_ENDPOINT_UNVERIFIABLE');
});
test('only absent supervisor and both free reserved ports allow update',async()=>{
  const r=await assessFactoryStartupBoundary({
    supervisor:async()=>({state:'OFF'}),probe:async()=> 'FREE'
  });
  assert.equal(r.code,'SAFE_TO_UPDATE');
  assert.equal(r.protectedRuntime,false);
  assert.equal(r.sourceUpdateAllowed,true);
});
test('both normal and home launchers gate Git update; protected runtime cannot install',async()=>{
  const [bat,home,runtime]=await Promise.all([
    script('Start-PlotPickle.bat'),script('GIT-PlotPickle.ps1'),
    script('scripts/windows-runtime.mjs')
  ]);
  const guard='scripts\\engineering-team\\windows\\launcher\\factory-startup-guard.mjs';
  assert.ok(bat.includes(guard));
  assert.ok(home.includes('factory-startup-guard.mjs'));
  assert.ok(bat.indexOf('FACTORY_UPDATE_GUARD')<bat.indexOf('node "%SOURCE_SYNC%"'));
  assert.ok(home.indexOf('factoryGuard')<home.indexOf('pull --ff-only'));
  assert.match(bat,/PLOTPICKLE_FACTORY_PROTECTED!"=="0" if not errorlevel 1/);
  assert.match(bat,/prepare-protected "%RUNTIME_ENV%"/);
  assert.match(bat,/if "!PLOTPICKLE_FACTORY_PROTECTED!"=="1" \(\s*call :dependencies_ready/);
  assert.match(runtime,/FACTORY_PROTECTED_RUNTIME_NOT_READY/);
  assert.match(runtime,/FACTORY_PROTECTED_RUNTIME_LINK_UNVERIFIED/);
  assert.match(runtime,/command === "prepare-protected"/);
  const part=runtime.slice(runtime.indexOf('function prepareProtected()'),
    runtime.indexOf('function markReady()'));
  for(const forbidden of ['removeDirectoryTree(', 'moveDirectory(', 'npm ci',
    'createJunction(', 'copyRuntimeManifests(', 'repairNativeBinding(']){
    assert.equal(part.includes(forbidden),false,forbidden);
  }
});
