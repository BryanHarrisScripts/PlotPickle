"use client";

/* eslint-disable @next/next/no-img-element -- project-owned authenticated local assets. */
import { useEffect, useMemo, useState } from "react";
import { authenticatedComputeFetch } from "../../core/auth/profile-request-browser";
import { applyStoryCommand } from "../../core/project/apply-command";
import type { WorldVisualArtifact } from "../../core/contracts/build-progress";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import { loadLibraryProjectSnapshot, saveActiveLibraryProject, sessionActiveProjectId } from "../../core/storage/project-library-browser";
import { persistActiveProfileProject, flushProfilePrivateWrites } from "../../core/storage/profile-private-browser";
import { registerProjectAssetSource, normalizeProjectAssetRegistry, type ProjectAssetRegistry } from "../../lib/projects/persistence/project-assets";
import styles from "./assets-world-studio.module.css";

type Source = { id: string; label: string; text: string; kind: "screenplay-location" | "world-brief" };
type Candidate = {
  projectId: string; revision: number; sourceId: string; routeId: string;
  assetUrl: string; prompt: string; provider: string; model: string; bytes: number; hash: string;
  view: string; lighting: string;
};
type Props = { project: LibraryPPFProject; routeId:string; routeReady:boolean; cloud:boolean; onSaved:(project:LibraryPPFProject)=>void };
const VIEWS = ["Establishing wide", "Street-level", "Aerial", "Interior", "Exterior", "Detail"] as const;
const LIGHTING = ["As written", "Daylight", "Evening", "Night", "Dawn", "Dusk"] as const;
const MEDIA = /^\/api\/local-ai\/assets\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/iu;

function storyLocations(project:LibraryPPFProject):Source[] {
  const headings=(project.sourceEvidence.screenplay?.passages||[])
    .filter(p=>p.text.trim() && (p.type==="scene-heading" || p.type==="scene" ||
      /^(?:INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)\s/iu.test(p.text.trim())))
    .slice(0,120);
  const seen=new Set<string>();
  const results:Source[]=[];
  for(const p of headings){
    const normalized=p.text.replace(/\s+/gu," ").trim().slice(0,200);
    const key=normalized.toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    results.push({id:p.id,label:normalized,text:p.text,kind:"screenplay-location"});
  }
  const brief=project.world.brief;
  if(brief.savedAt && brief.content.trim()){
    results.push({id:"saved-world-brief",label:"Saved World description",text:brief.content.slice(0,2400),kind:"world-brief"});
  }
  return results;
}

function guard(project:LibraryPPFProject){
  if(sessionActiveProjectId()!==project.id || loadLibraryProjectSnapshot(project.id)?.revision!==project.revision){
    throw new Error("Your active Library PPF has changed. Reopen ASSETS before editing World images.");
  }
}

async function verify(url:string) {
  if(!MEDIA.test(url)) throw new Error("Provider did not return a permitted local World image asset.");
  const response=await authenticatedComputeFetch(url,{cache:"no-store"});
  if(!response.ok || !response.headers.get("content-type")?.startsWith("image/")){
    throw new Error("World image media is missing or unreadable; Save and Approve are blocked.");
  }
  const buffer=await response.arrayBuffer();
  if(!buffer.byteLength)throw new Error("World image has no readable media bytes.");
  const sum=await crypto.subtle.digest("SHA-256",buffer);
  const hash="sha256:"+[...new Uint8Array(sum)].map(x=>x.toString(16).padStart(2,"0")).join("");
  return {bytes:buffer.byteLength,hash};
}

async function durableSave(before:LibraryPPFProject,next:LibraryPPFProject,proof:(p:LibraryPPFProject)=>boolean){
  guard(before);
  const saved=saveActiveLibraryProject(next);
  if(saved.id!==before.id)throw new Error("Library saved to an unexpected story.");
  await persistActiveProfileProject();
  await flushProfilePrivateWrites();
  if(sessionActiveProjectId()!==before.id)throw new Error("The active story changed while saving.");
  const readback=loadLibraryProjectSnapshot(before.id);
  if(!readback || readback.revision!==next.revision || !proof(readback)){
    throw new Error("Project read-back could not prove the World image and its media hash.");
  }
  return readback;
}

function registryForApproval(registry:ProjectAssetRegistry,artifactId:string,accepted:boolean):ProjectAssetRegistry {
  const targetId="world-location:"+artifactId;
  return normalizeProjectAssetRegistry({
    ...registry,
    assets:registry.assets.map(asset=>asset.targets.some(target=>target.kind==="other"&&target.id===targetId)?{
      ...asset,
      approvedVariationId:accepted?asset.variations.find(v=>v.extensions.worldArtifactId===artifactId)?.id||"": "",
      variations:asset.variations.map(v=>({
        ...v,approval:v.extensions.worldArtifactId===artifactId&&accepted?"approved":"unreviewed",
      })),
    }:asset),
  });
}

export default function AssetsWorldStudio({project,routeId,routeReady,cloud,onSaved}:Props){
  const sources=useMemo(()=>storyLocations(project),[project]);
  const [sourceId,setSourceId]=useState("");
  const [view,setView]=useState<string>(VIEWS[0]);
  const [lighting,setLighting]=useState<string>(LIGHTING[0]);
  const [direction,setDirection]=useState("");
  const [consent,setConsent]=useState(false);
  const [candidate,setCandidate]=useState<Candidate|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const source=sources.find(s=>s.id===sourceId)||sources[0]||null;
  useEffect(()=>{setCandidate(null);setSourceId("");setConsent(false);setNotice("");},[project.id]);
  const accepted=project.build.world.visualArtifacts.filter(a=>
    project.build.world.acceptedVisualArtifactIds.includes(a.id) && a.reviewState==="accepted");
  async function generate(){
    if(busy||!routeReady||!source||(cloud&&!consent))return;
    setBusy(true);setNotice("Generating one unsaved World reference from the selected story source…");
    try{
      guard(project);
      const latest=storyLocations(project).find(s=>s.id===source.id);
      if(!latest||latest.text!==source.text)throw new Error("The selected World source has changed.");
      const referenceImages=accepted.map(a=>a.assetUrl).filter(url=>MEDIA.test(url)).slice(0,2);
      const prompt=[
        "Create ONE coherent cinematic location/environment concept image from the supplied saved story evidence. Do not invent canon, new plot events, characters, or additional locations.",
        "Story title: "+project.title,
        "Source kind: "+latest.kind+"; stable source key: "+latest.id,
        "Original selected story context (the only location authority): "+latest.text.slice(0,2500),
        "Requested camera view: "+view+". Requested lighting: "+lighting+". Aspect: 3:2 landscape.",
        direction.trim()?"Human environment art direction (not canonical): "+direction.trim().slice(0,1200):"",
        "Keep established geography and approved references visually consistent. Make this a single clean environment still, not a collage.",
      ].filter(Boolean).join("\n\n");
      const res=await authenticatedComputeFetch("/api/local-ai/generate/image",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt,aspect:"landscape",requestCount:1,
          assetId:`assets-world-${project.id.replace(/[^a-z0-9-]/giu,"-")}-${Date.now()}`,
          referenceImages,billingAcknowledged:cloud&&consent}),
      });
      const result=await res.json() as {ok?:boolean;assetUrl?:string;provider?:string;model?:string;revisedPrompt?:string;message?:string};
      if(!res.ok||!result.ok||!result.assetUrl)throw new Error(result.message||"No World image candidate was returned.");
      const verified=await verify(result.assetUrl);
      guard(project);
      setCandidate({projectId:project.id,revision:project.revision,sourceId:source.id,routeId,
        assetUrl:result.assetUrl,prompt:result.revisedPrompt||prompt,provider:result.provider||routeId,
        model:result.model||"",view,lighting,bytes:verified.bytes,hash:verified.hash});
      setNotice("Image preview ready. Review, then Save a draft. No World or story canon changed.");
    }catch(error){setNotice(error instanceof Error?error.message:"World image generation failed.");}
    finally{setBusy(false);}
  }

  async function saveDraft(){
    if(busy||!candidate)return;
    setBusy(true);
    try{
      guard(project);
      if(candidate.projectId!==project.id||candidate.revision!==project.revision||
        candidate.routeId!==routeId||candidate.sourceId!==source?.id){
        throw new Error("This candidate belongs to a different project, source revision or image route.");
      }
      const verified=await verify(candidate.assetUrl);
      if(verified.bytes!==candidate.bytes||verified.hash!==candidate.hash)throw new Error("Image bytes changed since preview.");
      const now=new Date().toISOString();
      const id=crypto.randomUUID();
      const artifact:WorldVisualArtifact={
        id,assetUrl:candidate.assetUrl,prompt:candidate.prompt,createdAt:now,
        provider:candidate.provider,model:candidate.model,frameNumber:1,
        narrativeIntention:`${source.label} · ${candidate.view} · ${candidate.lighting}`,
        curriculumFrontier:"Foundations + World",
        sourceDecisionKeys:source.kind==="world-brief"?["world:brief"]:[`screenplay:${source.id}`],
        worldDecisionKeys:[source.id],
        retainedFoundationArtifactIds:project.build.foundations.acceptedVisualArtifactIds.slice(0,3),
        workflow:"assets/world-source-reference-v1",changeKind:"added",reviewState:"draft",parentArtifactId:null,
      };
      const registered=registerProjectAssetSource(project.assetRegistry,{
        kind:"image",target:{kind:"other",id:"world-location:"+id},source:candidate.assetUrl,
        label:project.title+" / "+source.label,provider:candidate.provider,model:candidate.model,
        prompt:candidate.prompt,bytes:candidate.bytes,contentHash:candidate.hash,
        approval:"unreviewed",updatedAt:now,generatedAt:now,provenanceIds:artifact.sourceDecisionKeys,
        variationExtensions:{worldArtifactId:id,sourceId:source.id,view:candidate.view,lighting:candidate.lighting,projectId:project.id},
      });
      const ref=registered.reference;
      if(!ref)throw new Error("World visual variation identity was not registered.");
      const changed=applyStoryCommand(project,{type:"world.visual.store",artifact,occurredAt:now}) as LibraryPPFProject;
      const next={...changed,assetRegistry:registered.registry};
      const readback=await durableSave(project,next,p=>
        p.build.world.visualArtifacts.some(a=>a.id===id&&a.assetUrl===candidate.assetUrl)&&
        p.assetRegistry.assets.some(a=>a.id===ref.assetId&&a.variations.some(v=>v.id===ref.variationId&&v.contentHash===candidate.hash)));
      onSaved(readback);setCandidate(null);
      setNotice("Source-bound World image saved as a draft in the active PPF.");
    }catch(error){setNotice(error instanceof Error?error.message:"World image Save failed.");}
    finally{setBusy(false);}
  }

  async function toggleAcceptance(artifact:WorldVisualArtifact,approve:boolean){
    if(busy)return;
    setBusy(true);
    try{
      guard(project);
      const verified=await verify(artifact.assetUrl);
      const owned=project.assetRegistry.assets.find(a=>a.targets.some(t=>t.kind==="other"&&t.id==="world-location:"+artifact.id));
      const version=owned?.variations.find(v=>v.extensions.worldArtifactId===artifact.id);
      if(!owned||!version||version.contentHash!==verified.hash||version.bytes!==verified.bytes){
        throw new Error("World image approval blocked: PPF variation hash/bytes cannot be verified.");
      }
      const now=new Date().toISOString();
      const changed=applyStoryCommand(project,{
        type:approve?"world.visual.accept":"world.visual.unaccept",artifactId:artifact.id,occurredAt:now,
      }) as LibraryPPFProject;
      const registry=registryForApproval(project.assetRegistry,artifact.id,approve);
      const next={...changed,assetRegistry:registry};
      const readback=await durableSave(project,next,p=>
        p.build.world.acceptedVisualArtifactIds.includes(artifact.id)===approve &&
        p.assetRegistry.assets.some(a=>a.id===owned.id&&Boolean(a.approvedVariationId)===approve));
      onSaved(readback);
      setNotice(approve?"World image approved for project reuse.":"Approval released; the saved World draft remains available.");
    }catch(error){setNotice(error instanceof Error?error.message:"World image approval failed.");}
    finally{setBusy(false);}
  }

  return <section className={styles.studio} aria-label="Create a project World reference" data-world-authoring="source-bound">
    <header><h3>Create a World image</h3><p>Choose an existing screenplay scene location or saved World description. New imagery never edits story canon.</p></header>
    {!source?<div role="status" className={styles.warning}>No saved scene locations or World brief are available. Add source material in the selected screenplay or World Map before generating.</div>:<>
      <label>Saved location / World source
        <select value={source.id} disabled={busy} onChange={e=>{setSourceId(e.target.value);setCandidate(null);}}>
          {sources.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <p className={styles.source}>Verified source ID: {source.id} · {source.kind}</p>
      <div className={styles.choices}>
        <label>View<select value={view} disabled={busy} onChange={e=>{setView(e.target.value);setCandidate(null);}}>{VIEWS.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Lighting<select value={lighting} disabled={busy} onChange={e=>{setLighting(e.target.value);setCandidate(null);}}>{LIGHTING.map(v=><option key={v}>{v}</option>)}</select></label>
      </div>
      <label>Human art direction<textarea maxLength={1200} rows={3} value={direction}
        placeholder="Optional framing, visual style or production notes"
        onChange={e=>{setDirection(e.target.value);setCandidate(null);}} /></label>
      <p>Selected image provider: {routeId||"Unavailable"} · {routeReady?"Verified":"Needs test"}</p>
      {cloud?<label className={styles.consent}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
        Authorize one paid cloud generation request and sharing this selected story context / approved images.</label>:null}
      <button type="button" disabled={busy||!routeReady||(cloud&&!consent)} onClick={()=>void generate()}>
        {busy?"Working…":"Generate 1 World image"}</button>
      {candidate&&candidate.projectId===project.id&&candidate.sourceId===source.id?<div className={styles.preview}>
        <img src={candidate.assetUrl} alt={source.label+" unsaved World image candidate"}/>
        <div><strong>Unsaved preview</strong><p>{candidate.provider} · {candidate.model}</p>
          <button type="button" disabled={busy} onClick={()=>void saveDraft()}>Save World draft</button>{" "}
          <button type="button" disabled={busy} onClick={()=>setCandidate(null)}>Discard</button></div>
      </div>:null}
    </>}
    <div className={styles.saved} aria-label="World draft review and approval">
      {project.build.world.visualArtifacts.filter(a=>a.workflow==="assets/world-source-reference-v1").slice(0,15).map(a=><div key={a.id}>
        <span>{a.narrativeIntention} · {project.build.world.acceptedVisualArtifactIds.includes(a.id)?"Approved":"Draft"}</span>
        <button type="button" disabled={busy} onClick={()=>void toggleAcceptance(a,!project.build.world.acceptedVisualArtifactIds.includes(a.id))}>
          {project.build.world.acceptedVisualArtifactIds.includes(a.id)?"Unlock":"Approve"}
        </button>
      </div>)}
    </div>
    {notice?<p role="status" aria-live="polite" className={styles.notice}>{notice}</p>:null}
  </section>;
}
