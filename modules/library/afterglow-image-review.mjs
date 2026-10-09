/**
 * #2863 — exact per-character image review, pure and read-only.
 *
 * One URL and a similar filename do not imply same saved image bytes.
 * Manifest-listed GitHub files are separate packaged reference artwork.
 * A Keep/Exclude changes only the *candidate*, never historical snapshots.
 */
const IMAGE = /^\/(?:api\/local-ai\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*|assets\/library\/examples\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*)\.webp$/i;
const EXACT_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.webp$/i;
const record = value => value && typeof value==="object" && !Array.isArray(value);
export const afterglowImageKey = (characterId,id,url) => JSON.stringify([characterId,id,url]);

function isReference(ref,characterId) {
  return record(ref) && typeof ref.id==="string" && ref.id.length>0
    && typeof ref.characterId==="string" && ref.characterId===characterId
    && typeof ref.versionId==="string" && ref.versionId.length>0
    && typeof ref.assetUrl==="string" && IMAGE.test(ref.assetUrl);
}

export function listAfterglowImageChoices({sources,manifest}) {
  if(!Array.isArray(sources)||!Array.isArray(manifest?.assets)) {
    throw new Error("Image review requires complete snapshot sources and the committed package manifest.");
  }
  const packaged=new Map();
  for(const item of manifest.assets) {
    const path=item?.target;
    if(typeof path!=="string" || !/^generated\/[A-Za-z0-9][A-Za-z0-9._-]*\.webp$/i.test(path)) continue;
    const filename=path.slice("generated/".length);
    if(!EXACT_FILENAME.test(filename) || !/^[a-f0-9]{64}$/i.test(String(item.contentHash).replace(/^sha256:/i,"")))continue;
    if(!packaged.has(filename))packaged.set(filename,[]);
    packaged.get(filename).push(item);
  }
  const map=new Map();
  for(const source of sources) {
    const sourceKey=source?.sourceKey??source?.project?.id;
    if(typeof sourceKey!=="string" || !sourceKey || !record(source?.project)) {
      throw new Error("Image review rejected a source without a stable snapshot identity.");
    }
    for(const pack of source.project.worldMap?.characterVisuals??[]) {
      if(!record(pack) || !Array.isArray(pack.references))continue;
      for(const ref of pack.references) {
        if(!isReference(ref,pack.characterId))continue;
        const key=afterglowImageKey(pack.characterId,ref.id,ref.assetUrl);
        const filename=ref.assetUrl.split("/").at(-1);
        const matches=packaged.get(filename)??[];
        // A manifest public URL must match the *exact target basename*;
        // never infer a GitHub address for arbitrary user filenames.
        const match=matches.length===1?matches[0]:null;
        if(!map.has(key))map.set(key,{
          key,characterId:pack.characterId,characterName:pack.characterName,
          id:ref.id,view:ref.view,versionId:ref.versionId,
          url:ref.assetUrl,reference:structuredClone(ref),
          sourcePackage:structuredClone(pack),sourceIds:[],
          packagedPublicUrl:match?.publicUrl??null,
          githubUrl:match? "https://github.com/BryanHarrisScripts/PlotPickle/blob/main/public/assets/library/examples/afterglow/current/"+match.target:null,
          packagedContentHash:match?.contentHash??null,
          conflictingSourceMetadata:false,
        });
        const item=map.get(key);
        if(!item.sourceIds.includes(sourceKey))item.sourceIds.push(sourceKey);
        if(JSON.stringify(item.reference)!==JSON.stringify(ref))item.conflictingSourceMetadata=true;
      }
    }
  }
  return [...map.values()].sort((a,b)=>(a.characterName+" "+a.view+" "+a.key)
    .localeCompare(b.characterName+" "+b.view+" "+b.key));
}

/** Review decisions must be keyed to exact inventory items. */
export function applyAfterglowImageChoices({candidate,items,choices}) {
  if(!record(candidate)||!Array.isArray(items)||!record(choices))throw new Error("Image draft requires validated inputs.");
  const indexed=new Map(items.map(item=>[item.key,item]));
  if(indexed.size!==items.length)throw new Error("Image review contains duplicate reference identities.");
  for(const [key,choice] of Object.entries(choices)) {
    if(!indexed.has(key)||!["keep","exclude"].includes(choice)) {
      throw new Error("Image decision is not part of the current reviewed snapshot inventory.");
    }
    if(indexed.get(key).conflictingSourceMetadata) {
      throw new Error("Conflicting image metadata requires independent verification before choosing.");
    }
  }
  const project=structuredClone(candidate);
  if(!record(project.worldMap))project.worldMap={version:1,characterVisuals:[]};
  if(!Array.isArray(project.worldMap.characterVisuals))project.worldMap.characterVisuals=[];
  const clearedLocks=[];
  const selected=Object.entries(choices).sort(([a],[b])=>a.localeCompare(b));
  // Exclusions first allow a competing saved reference with the same ID to
  // replace only the explicitly excluded candidate reference.
  for(const [key,choice] of selected.filter(([,value])=>value==="exclude")) {
    const item=indexed.get(key);
    const pack=project.worldMap.characterVisuals.find(p=>p.characterId===item.characterId);
    if(!pack)continue;
    pack.references=pack.references.filter(ref=>!(ref.id===item.id && ref.assetUrl===item.url));
    if(pack.lockedVersionId && !pack.references.some(ref=>ref.versionId===pack.lockedVersionId)) {
      clearedLocks.push({characterId:item.characterId,versionId:pack.lockedVersionId});
      pack.lockedVersionId=null;pack.approvedAt=null;
    }
  }
  for(const [key,choice] of selected.filter(([,value])=>value==="keep")) {
    const item=indexed.get(key);
    const existing=project.worldMap.characterVisuals.find(p=>p.characterId===item.characterId);
    if(existing) {
      if(existing.references.some(ref=>ref.id===item.id && ref.assetUrl===item.url))continue;
      if(existing.references.some(ref=>ref.id===item.id)) {
        throw new Error("A different image holds this reference identity; exclude it explicitly before keeping another.");
      }
      existing.references.push(structuredClone(item.reference));
    } else {
      const pack=structuredClone(item.sourcePackage);
      pack.references=[structuredClone(item.reference)];
      // Human Keep retains the actual reference, not an unproven lock on an
      // incomplete restored character package.
      pack.lockedVersionId=null;pack.approvedAt=null;
      project.worldMap.characterVisuals.push(pack);
    }
  }
  return {candidate:project,clearedLocks,reviewedCount:selected.length,
    readyForHumanCommit:false,packageModified:false};
}

export function imageIncludedInCandidate(project,item) {
  return Boolean(project?.worldMap?.characterVisuals?.some(pack=>
    pack.characterId===item.characterId &&
    pack.references?.some(ref=>ref.id===item.id&&ref.assetUrl===item.url)));
}
