/**
 * #3241 diagnostic partition: bounded, fixed-root, metadata-only subtree profiling.
 * A large first child must not monopolize the scan budget. Each eligible
 * immediate child receives its own short budget. No cleanup or retention proof.
 */
import { lstat, opendir, realpath } from "node:fs/promises";
import path from "node:path";
import { inventoryFactoryStorage } from "../../queue/storage/inventory.mjs";

const MAX_CHILDREN = 128;
const MAX_PROFILE_MS = 45000;
const PER_CHILD_MS = 2500;
const PER_CHILD_ENTRIES = 12000;
const monotonicInside = (root, child) => {
  const rel = path.relative(root, child);
  return !!rel && !path.isAbsolute(rel) && rel !== ".." &&
    !rel.startsWith(`..${path.sep}`);
};
const identical = (a,b) => process.platform === "win32"
  ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
  : path.resolve(a) === path.resolve(b);
const validDirectory = async (directory) => {
  let current = path.resolve(directory);
  for (;;) {
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error("UNVERIFIED_DIRECTORY");
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (!identical(await realpath(directory), directory)) throw Error("REDIRECTED_DIRECTORY");
};
const priority = name => {
  const names = ["chat-candidate-stages", "worktrees", "jobs", "runs",
    "receipts", "evidence", "logs", "temp", "cache"];
  const n = names.indexOf(name.toLowerCase());
  return n === -1 ? names.length : n;
};

/** Root is selected by the server from four fixed, nonoverlapping roots. */
export async function profileFactoryStorage({
  selected, rootId, scan = inventoryFactoryStorage,
  list = opendir, stat = lstat, resolvePath = realpath,
  verifyDirectory = validDirectory, now = Date.now,
} = {}) {
  if (!selected || selected.id !== rootId ||
      !["runtimes","npm-cache","engineering-team","repository-artifacts"].includes(rootId) ||
      !path.isAbsolute(selected.directory)) throw Error("STORAGE_SELECTION_INVALID");
  const target = rootId === "engineering-team"
    ? path.join(selected.directory, "autonomous-queue") : selected.directory;
  await verifyDirectory(target);
  const started = now();
  let allCount=0, truncated=false;
  const candidates=[];
  const handle=await list(target);
  try {
    for await (const entry of handle) {
      if (allCount >= MAX_CHILDREN || now()-started >= MAX_PROFILE_MS/3) {
        truncated=true; break;
      }
      allCount++;
      const name=entry.name;
      // Never accept dot traversal, separators, device path or arbitrary path.
      if (!name || name === "." || name === ".." || name.includes("/") ||
          name.includes("\\") || name.includes("\0")) {
        truncated=true; continue;
      }
      const full=path.join(target,name);
      if (!monotonicInside(target,full)) { truncated=true; continue; }
      candidates.push({name,full});
    }
  } finally {
    // Async iteration normally closes the handle; tolerates already closed handles.
    await handle.close?.().catch?.(()=>{});
  }
  candidates.sort((a,b) => priority(a.name)-priority(b.name) ||
    a.name.localeCompare(b.name));
  const rows=[];
  let lowerBound=false, observed=0n, totalEntries=0, skipped=0;
  for (const child of candidates) {
    if (now()-started >= MAX_PROFILE_MS) { truncated=true; break; }
    let state="BLOCKED",code="PROFILE_CHILD_UNVERIFIED";
    let bytes="0",files=0,directories=0,links=0,entries=0;
    try {
      const before=await stat(child.full);
      if (before.isSymbolicLink()) {
        code="PROFILE_LINK_SKIPPED"; links=1; skipped++;
      } else if (before.isFile()) {
        state="COMPLETE";code="PROFILE_FILE_METADATA";
        bytes=String(before.size); files=1; entries=1;
      } else if (before.isDirectory()) {
        if (!identical(await resolvePath(child.full),child.full))
          throw Error("PROFILE_PATH_REDIRECTED");
        const left=Math.max(1000,Math.min(PER_CHILD_MS,MAX_PROFILE_MS-(now()-started)));
        const result=await scan({roots:[{
          id:rootId,kind:selected.kind,directory:child.full,
        }],maxEntries:PER_CHILD_ENTRIES,maxDurationMs:left});
        const item=result?.roots?.[0];
        if (result?.metadataOnly !== true || result?.cleanupAuthorized !== false ||
            result?.bytesAreReclaimable !== false || item?.id !== rootId)
          throw Error("PROFILE_SCAN_UNVERIFIED");
        state=item.state;code=item.code;
        if (!["COMPLETE","PARTIAL","MISSING","BLOCKED"].includes(state))
          throw Error("PROFILE_STATE_UNVERIFIED");
        if (!/^[0-9]+$/u.test(item.apparentBytes || ""))
          throw Error("PROFILE_BYTES_UNVERIFIED");
        bytes=item.apparentBytes;
        files=item.files;directories=item.directories;links=item.skippedLinks;
        entries=result.visitedEntries;
        const after=await stat(child.full);
        if (!after.isDirectory() || after.isSymbolicLink() ||
            before.ino !== after.ino || before.dev !== after.dev ||
            !identical(await resolvePath(child.full),child.full))
          throw Error("PROFILE_CHILD_CHANGED");
      }
    } catch { state="BLOCKED";code="PROFILE_CHILD_UNVERIFIED";bytes="0"; }
    if (state!=="COMPLETE")lowerBound=true;
    observed+=BigInt(bytes); totalEntries+=Number.isSafeInteger(entries)?entries:0;
    rows.push({name:child.name,state,code,apparentBytes:bytes,files,
      directories,skippedLinks:links,visitedEntries:entries});
  }
  if (truncated || rows.length !== candidates.length) lowerBound=true;
  rows.sort((a,b)=>{
    const x=BigInt(a.apparentBytes),y=BigInt(b.apparentBytes);
    return x>y?-1:x<y?1:a.name.localeCompare(b.name);
  });
  const state=lowerBound?"PARTIAL":"COMPLETE";
  return {
    state,code:lowerBound?"PROFILE_INCOMPLETE":"INVENTORY_COMPLETE",
    rootId,scope:rootId==="engineering-team"?"autonomous-queue":"root",
    scanMode:"profile",apparentBytes:String(observed),
    visitedEntries:totalEntries,children:rows,
    childrenObserved:candidates.length,childrenOmitted:candidates.length-rows.length,
    discoveryTruncated:truncated,skippedLinks:skipped,
    limit:{maxChildren:MAX_CHILDREN,maxDurationMs:MAX_PROFILE_MS,
      perChildMaxEntries:PER_CHILD_ENTRIES,perChildMaxDurationMs:PER_CHILD_MS},
    totalsAreLowerBounds:lowerBound,metadataOnly:true,
    cleanupAuthorized:false,bytesAreReclaimable:false,
    retentionReferenceState:"UNVERIFIED",
  };
}
