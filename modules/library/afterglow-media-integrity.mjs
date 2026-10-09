/**
 * #2863 — read-only Afterglow media evidence, fail closed.
 * Checks actual bytes, image decoder, and independent available hash evidence.
 * An index hash read TODAY is NOT proof of the originally saved media.
 * No network access or profile authority here: caller injects read/decode/hash.
 */
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const SHA = /^sha256:[a-f0-9]{64}$/i;
const LOCAL = /^\/api\/local-ai\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/i;
const PACKAGE = /^\/assets\/library\/examples\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/i;
const BUNDLED = /^\/afterglow\/storyboard\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/i;
const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
const classify = url => LOCAL.test(url) ? "local" : PACKAGE.test(url) ? "packaged"
  : BUNDLED.test(url) ? "bundled" : "unsupported";

function imageReferences(project) {
  const found = new Set();
  const visit = value => {
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    if (!record(value)) return;
    if (typeof value.assetUrl === "string" && value.assetUrl) found.add(value.assetUrl);
    for (const child of Object.values(value)) visit(child);
  };
  visit(project);
  return found;
}

/** Includes media in unselected historical copies, without treating it as current master. */
export function inventoryAfterglowMedia({candidate, sources}) {
  if (!record(candidate) || !Array.isArray(sources) || sources.some(x=>!record(x?.project)
      || typeof x.project.id!=="string" || !x.project.id)) {
    throw new Error("Media inventory requires the draft master and complete saved snapshots.");
  }
  const selected = imageReferences(candidate);
  const inventory = new Map();
  const include=(url,sourceProjectId)=>{
    const existing=inventory.get(url)??{url,kind:classify(url),selected:selected.has(url),sourceProjectIds:[]};
    if(sourceProjectId && !existing.sourceProjectIds.includes(sourceProjectId))existing.sourceProjectIds.push(sourceProjectId);
    inventory.set(url,existing);
  };
  for(const url of selected) include(url,null);
  for(const {project,sourceKey} of sources) for(const url of imageReferences(project)) include(url,sourceKey??project.id);
  return [...inventory.values()].sort((a,b)=>a.url.localeCompare(b.url));
}

function sourceHash(manifest,url) {
  if (!Array.isArray(manifest?.assets)) return null;
  const hashes=new Set(manifest.assets.filter(x=>x?.publicUrl===url)
    .map(x=>x?.contentHash).filter(x=>typeof x==="string" && SHA.test(x)));
  return hashes.size===1?[...hashes][0].toLowerCase():null;
}
function localHash(index,url) {
  if (!Array.isArray(index?.assets)) return null;
  const hashes=new Set(index.assets.filter(x=>x?.url===url)
    .map(x=>x?.contentHash).filter(x=>typeof x==="string" && SHA.test(x)));
  return hashes.size===1?[...hashes][0].toLowerCase():null;
}
function imageSignature(bytes,url) {
  const ext=url.split(".").at(-1)?.toLowerCase();
  if(ext==="png") return bytes.length>=24 && bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71
    && bytes[4]===13 && bytes[5]===10 && bytes[6]===26 && bytes[7]===10;
  if(ext==="webp") return bytes.length>=16 && String.fromCharCode(...bytes.subarray(0,4))==="RIFF"
    && String.fromCharCode(...bytes.subarray(8,12))==="WEBP";
  if(ext==="jpg"||ext==="jpeg") return bytes.length>=4 && bytes[0]===255 && bytes[1]===216
    && bytes.at(-2)===255 && bytes.at(-1)===217;
  return false;
}
function outcome(item,status,reason,contentHash=null) {
  return {...item,status,reason,contentHash};
}

/**
 * The caller guarantees the signed-in session and supplies fetch/crypto/image decode.
 * Missing, invalid, tampered, stale or unsupported media are evidence, never silent omissions.
 * In-memory SHA256 is not persisted and cannot prove a past un-hashed local image's identity.
 */
export async function verifyAfterglowMedia({candidate,sources,packagedManifest,localAssetIndex,read,hash,decode,beforeRead}) {
  if(typeof read!=="function" || typeof hash!=="function" || typeof decode!=="function"
     ||typeof beforeRead!=="function")throw new Error("Media verification requires guarded byte, hash and decode operations.");
  const items=inventoryAfterglowMedia({candidate,sources}),results=[];
  for(const item of items){
    await beforeRead();
    if(item.kind==="unsupported") {
      results.push(outcome(item,"unsupported","Only exact same-origin PlotPickle image paths may be inspected."));continue;
    }
    const expectedHash=item.kind==="packaged"?sourceHash(packagedManifest,item.url)
      :item.kind==="local"?localHash(localAssetIndex,item.url):null;
    const authority=item.kind==="packaged"?"packaged-manifest":item.kind==="local"?"current-local-index":"none";
    try {
      const response=await read(item.url,MAX_IMAGE_BYTES);
      if(!response || response.ok!==true || !(response.bytes instanceof Uint8Array)) {
        results.push(outcome(item,"missing","Image bytes could not be read (missing or denied)."));continue;
      }
      const {bytes}=response;
      if(bytes.length<16 || bytes.length>MAX_IMAGE_BYTES || !imageSignature(bytes,item.url)) {
        results.push(outcome(item,"corrupt","Empty, oversized or invalid image signature."));continue;
      }
      const actual=await hash(bytes);
      if(typeof actual!=="string" || !SHA.test(actual)) {
        results.push(outcome(item,"unverifiable","SHA-256 digest unavailable."));continue;
      }
      const normalized=actual.toLowerCase();
      if(expectedHash && expectedHash!==normalized) {
        results.push(outcome(item,"hash-mismatch","Image bytes differ from the available recorded digest.",normalized));continue;
      }
      await decode(bytes,item.url);
      if(item.kind==="packaged" && expectedHash) {
        results.push({...outcome(item,"verified-pinned","Readable and matches the packaged release manifest.",normalized),
          evidenceAuthority:authority});
      } else if(item.kind==="local" && expectedHash) {
        results.push({...outcome(item,"verified-current","Readable and matches today's local index; no historical saved digest.",normalized),
          evidenceAuthority:authority});
      } else {
        results.push({...outcome(item,"readable-unpinned","Readable, but no authoritative saved content hash was available.",normalized),
          evidenceAuthority:"none"});
      }
    } catch(error) {
      results.push(outcome(item,"unreadable",error instanceof Error?error.message.slice(0,220):"Image decoder or byte reader failed."));
    }
  }
  await beforeRead();
  return {
    results,
    selectedCount:items.filter(x=>x.selected).length,
    historyCount:items.filter(x=>!x.selected).length,
    verifiedPinned:results.filter(x=>x.selected&&x.status==="verified-pinned").length,
    readableWithoutSavedProof:results.filter(x=>x.selected&&["verified-current","readable-unpinned"].includes(x.status)).length,
    failed:results.filter(x=>x.selected&&!["verified-pinned","verified-current","readable-unpinned"].includes(x.status)).length,
    readyForHumanCommit:false,
    packageModified:false,
  };
}
