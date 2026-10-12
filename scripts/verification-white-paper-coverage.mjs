import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateWhitePaperCoverage, renderWhitePaperCoverage, coverageInventoryPaths } from "../lib/verification/development/white-paper-coverage.mjs";

const documentPath="docs/verification/2936-white-paper-coverage.json";
const document=JSON.parse(await readFile(documentPath,"utf8"));
const revision=document.legacyInventory.revision;
if(!/^[a-f0-9]{40}$/u.test(revision))throw new Error("Invalid baseline revision");
const git=(args)=>execFileSync("git",args,{maxBuffer:32*1024*1024});
git(["merge-base","--is-ancestor",revision,"HEAD"]);
const catalog=JSON.parse(git(["show",`${revision}:config/verification/test-catalog.json`]).toString("utf8"));
const tracked=git(["ls-tree","-r","--name-only",revision]).toString("utf8").trim().split("\n");
const owners=new Map();
for(const entry of catalog.entries)for(const file of entry.runner.targets){const ids=owners.get(file)||[];ids.push(entry.id);owners.set(file,ids);}
const paths=coverageInventoryPaths(tracked,catalog);
const inventoryFiles=new Map();
for(const file of [...paths].sort()) {
  const binding=catalog.truthGovernance.bindings.find(item=>item.target===file);
  inventoryFiles.set(file,{bytes:git(["show",`${revision}:${file}`]),catalogueIds:(owners.get(file)||[]).sort(),truthRefs:binding?.truthRefs||[]});
}
const enforcementFiles=new Map();
for(const file of new Set(document.requirements.flatMap(row=>row.enforcement.references.map(ref=>ref.path))))enforcementFiles.set(file,await readFile(file,"utf8"));
const source=await readFile(document.source.path,"utf8");
const sourceFiles=new Map();
for(const truth of catalog.truthGovernance.approvedTruths)sourceFiles.set(truth.source,(await readFile(truth.source,"utf8")).replaceAll("\r\n","\n"));
const result={...validateWhitePaperCoverage(document,{source,inventoryFiles,enforcementFiles,catalogueTargets:new Set(owners.keys()),approvedEditions:new Set(catalog.truthGovernance.approvedTruths.map(truth=>`${truth.id}@${truth.version}`)),catalog,sourceFiles}),implementationRevision:git(["rev-parse","HEAD"]).toString("utf8").trim(),runtime:{platform:process.platform,node:process.version},scope:"audit-integrity-only"};
const directory=path.resolve(".artifacts/white-paper-coverage");
await mkdir(directory,{recursive:true});
await writeFile(path.join(directory,"integrity.json"),`${JSON.stringify(result,null,2)}\n`);
await writeFile(path.join(directory,"coverage.md"),renderWhitePaperCoverage(document,result));
console.log(JSON.stringify(result,null,2));
if(result.status!=="VALID_AUDIT_PROPOSAL")process.exitCode=1;
