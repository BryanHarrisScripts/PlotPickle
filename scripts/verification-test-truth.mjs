import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assessRepositoryTestTruth } from "../lib/verification/development/test-truth-admission.mjs";

const args=process.argv.slice(2), baseIndex=args.indexOf("--base-ref");
const report=await assessRepositoryTestTruth({baseRef:baseIndex>=0?args[baseIndex+1]:"origin/main",includeWorkingTree:args.includes("--working-tree")});
const directory=path.resolve(".artifacts/verification-test-truth");
await mkdir(directory,{recursive:true});
await writeFile(path.join(directory,"admission.json"),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
if(report.status!=="ready")process.exitCode=1;
