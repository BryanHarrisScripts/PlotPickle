import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const target="scripts/engineering-team/windows/Measure-PlotPickleRecentCDrive.ps1";
const load=()=>readFile(target,"utf8");

test("#3241 owner-only C-drive survey is read-only, bounded and path-redacted",async()=>{
  const script=await load();
  assert.ok(script.includes("#requires -Version 5.1"));
  assert.ok(script.includes("$root = 'C:\\'"),"fixed C root");
  assert.ok(script.includes("[ValidateRange(1,30)][int]$Days = 5"));
  assert.ok(script.includes("[ValidateRange(30,900)][int]$MaxSeconds = 300"));
  assert.ok(script.includes("[ValidateRange(1000,3000000)][int]$MaxEntries = 1500000"));
  assert.ok(script.includes("Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop"));
  assert.ok(script.includes("ReparsePoint"));
  assert.ok(script.includes("$global:ppSkippedLinks++"));
  assert.ok(script.includes("CreationTimeUtc"));
  assert.ok(script.includes("LastWriteTimeUtc"));
  assert.ok(script.includes("Get-Group $file.FullName"));
  assert.ok(script.includes("contentsRead=$false"));
  assert.ok(script.includes("fullPathsReturned=$false"));
  assert.ok(script.includes("deletionAuthorized=$false"));
  assert.ok(script.includes("repairAttempted=$false"));
  assert.ok(script.includes("state='NOT_TESTED'"));
  assert.ok(script.includes("PARTIAL"));
  for(const forbidden of ["Remove-Item","Clear-Content","Set-Content","New-Item",
    "Set-Item","Move-Item","Copy-Item","ReadAllBytes(","ReadAllText(",
    "Get-Content","Invoke-Expression","Invoke-WebRequest","Invoke-RestMethod",
    "chkdsk.exe","sfc.exe","Repair-Volume","Format-Volume","-Fix","-Repair"]){
    assert.equal(script.includes(forbidden),false,`forbidden operation ${forbidden}`);
  }
  assert.doesNotMatch(script,/param\([\s\S]*?\$RootPath\s*=/i,"owner cannot remotely expand scan root");
});

test("#3241 native Windows fixture scans files without returning names or file contents",{
  skip:process.platform!=="win32",
},async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),"pp-recent-cdrive-fixture-"));
  try{
    await writeFile(path.join(folder,"PRIVATE_STORY_NOT_TO_DISCLOSE.txt"),"PRIVATE_STORY_CONTENT_SENTINEL");
    await writeFile(path.join(folder,"disk-growth-demo.bin"),Buffer.alloc(10000,1));
    const source=await load();
    const original="$root = 'C:\\'";
    assert.ok(source.includes(original));
    const privateRoot=folder.replaceAll("'","''");
    const fixturePath=path.join(folder,"fixture.ps1");
    await writeFile(fixturePath,source.replace(original,`$root = '${privateRoot}'`),"utf8");
    const result=spawnSync("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass",
      "-File",fixturePath,"-Days","5","-MaxSeconds","30","-MaxEntries","1000"],
      {encoding:"utf8",timeout:60000});
    assert.equal(result.status,0,`Windows PowerShell failed: ${result.stderr?.slice(0,1000)}`);
    const report=JSON.parse(result.stdout);
    assert.equal(report.schemaVersion,1);
    assert.equal(report.tool,"PlotPickle-RecentCDriveMetadata");
    assert.equal(report.privacy.contentsRead,false);
    assert.equal(report.privacy.deletionAuthorized,false);
    assert.equal(report.privacy.fullPathsReturned,false);
    assert.ok(report.visitedEntries>=2);
    assert.ok(report.createdFilesApparentBytes>=10000);
    assert.ok(report.buckets.some(b=>b.createdFiles>=1));
    assert.ok(!result.stdout.includes("PRIVATE_STORY_NOT_TO_DISCLOSE"));
    assert.ok(!result.stdout.includes("PRIVATE_STORY_CONTENT_SENTINEL"));
    assert.ok(!result.stdout.includes(folder));
  }finally{await rm(folder,{recursive:true,force:true});}
});
