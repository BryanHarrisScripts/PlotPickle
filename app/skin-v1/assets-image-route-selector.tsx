"use client";

import { useEffect, useMemo, useState } from "react";
import { authenticatedComputeFetch } from "../../core/auth/profile-request-browser";
import styles from "./assets-image-route-selector.module.css";

export type ImageOption = {
  ready?: boolean; configured?: boolean; disabled?: boolean; supported?: boolean;
  locality?: string; model?: string; error?: string; verifiedAt?: string; cost?: string;
};
export type AssetsImageRoutingStatus = {
  ok?: boolean; choice?: {image?:string};
  image?: {selected?:string; options?:Record<string,ImageOption>};
  joins?: {image?: {engine?:string;provider?:string;route?:string}};
  message?:string;
};
type Mode = "local" | "cloud" | "hybrid";
const eligible = (option: ImageOption) =>
  option.supported !== false && option.disabled !== true && (option.locality === "local" || option.locality === "cloud");

async function request<T>(path:string, body?:Record<string,unknown>):Promise<T> {
  const response = await authenticatedComputeFetch(path, body ? {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
  } : {cache:"no-store"});
  const data = await response.json() as T & {ok?:boolean;message?:string};
  if (!response.ok || data.ok === false) throw new Error(data.message || "The existing capability gateway did not authorize the change.");
  return data;
}

export default function AssetsImageRouteSelector({
  status, onChanged,
}:{
  readonly status:AssetsImageRoutingStatus|null;
  readonly onChanged:(value:AssetsImageRoutingStatus)=>void;
}) {
  const [mode,setMode] = useState<Mode>("local");
  const [route,setRoute] = useState("");
  const [stage,setStage] = useState<"idle"|"preview">("idle");
  const [charges,setCharges] = useState(false);
  const [share,setShare] = useState(false);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const selected = status?.image?.selected || status?.choice?.image || "";
  const options = status?.image?.options || {};
  const eligibleOptions = useMemo(() => Object.entries(options).filter(([,value])=>eligible(value) && value.locality===mode),[options,mode]);
  const selectedOption = options[route];
  const current = options[selected];
  const active = eligibleOptions.some(([id])=>id===route) ? route : eligibleOptions[0]?.[0] || "";
  const activeOption = options[active];
  const cloud = activeOption?.locality === "cloud";
  const hybrid = mode === "hybrid";

  useEffect(()=> { setStage("idle"); setCharges(false); setShare(false); },[mode,route]);
  const capable = Boolean(active && activeOption && eligible(activeOption) && activeOption.configured!==false);
  const routeReady = activeOption?.ready===true && Boolean(activeOption?.verifiedAt);

  async function refresh(announce=false) {
    try {
      const next=await request<AssetsImageRoutingStatus>("/api/ai-routing/status");
      onChanged(next);
      if(announce)setNotice("Current provider verification reloaded.");
      return next;
    } catch(error){
      setNotice(error instanceof Error?error.message:"Could not inspect image routing.");
      return null;
    }
  }

  async function confirm() {
    if(busy||stage!=="preview"||hybrid||!capable||!activeOption)return;
    if(cloud&&(!charges||!share)){setNotice("Confirm cloud charges and source/reference sharing before this operation.");return;}
    const chosenRoute=active;
    const oldSelected=selected;
    setBusy(true);setNotice("Verifying the requested image route without changing the selected provider.");
    try {
      const before=await request<AssetsImageRoutingStatus>("/api/ai-routing/status");
      const latestOption=before.image?.options?.[chosenRoute];
      if(!latestOption||latestOption.supported===false||latestOption.disabled||latestOption.configured===false){
        throw new Error("Route setup is not supported or configured. The existing selected provider was retained.");
      }
      // An image capability test runs only after this explicit Human preview and consent.
      if(!latestOption.ready||!latestOption.verifiedAt){
        await request<Record<string,unknown>>("/api/media-routing/test/image",{route:chosenRoute});
      }
      const verified=await request<AssetsImageRoutingStatus>("/api/ai-routing/status");
      const proof=verified.image?.options?.[chosenRoute];
      if(!proof?.ready||!proof.verifiedAt)throw new Error("Capability test did not yield a verified, ready route. Previous selection retained.");
      if(verified.image?.selected!==chosenRoute){
        await request<AssetsImageRoutingStatus>("/api/ai-routing/select",{
          capability:"image",route:chosenRoute,paidAcknowledged:cloud&&charges,
          dataSharingAcknowledged:cloud&&share,
        });
      }
      const persisted=await request<AssetsImageRoutingStatus>("/api/ai-routing/status");
      if(persisted.image?.selected!==chosenRoute||persisted.image?.options?.[chosenRoute]?.ready!==true){
        throw new Error("Route read-back is inconsistent. Inspect existing Connections before generating images.");
      }
      onChanged(persisted);
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
      window.dispatchEvent(new CustomEvent("plotpickle:connection-status-refresh"));
      setNotice("Verified image route selected: "+chosenRoute+". Characters and Posters now use this route.");
    } catch(error){
      await refresh();
      setNotice((error instanceof Error?error.message:"Image route verification failed.")+
        (oldSelected===chosenRoute?"":" Previously selected route was not deliberately changed."));
    } finally {
      setBusy(false);setStage("idle");setCharges(false);setShare(false);
    }
  }

  return <section className={styles.selector} aria-label="ASSETS image compute route" data-assets-image-routing="true">
    <header><div><span>ASSETS / CONNECTIONS</span><h2>Image generation route</h2></div>
      <button type="button" disabled={busy} onClick={()=>void refresh(true)}>Refresh verification</button>
    </header>
    <p>Currently selected: <strong>{selected||"None"}</strong> · {current?.ready?"Ready":"Needs test"} · {current?.model||"No verified model"}</p>
    <div className={styles.modes} role="group" aria-label="Local Cloud or Hybrid image routing">
      {(["local","cloud","hybrid"] as const).map(value=><button key={value} type="button" disabled={busy}
        aria-pressed={mode===value} onClick={()=>{setMode(value);setRoute("");setNotice("");}}>
        {value==="local"?"Local":value==="cloud"?"Cloud":"Hybrid"}</button>)}
    </div>
    {hybrid ? <div className={styles.blocked} role="status">
      <strong>Hybrid · no verified cross-locality image workflow</strong>
      <p>A combined Local/Cloud image engine must have an executable, verified pairing in existing Connections before it can be offered here. Switching one image to cloud is not Hybrid. No paid fallback has been activated.</p>
      <p>Current saved image Join: {status?.joins?.image?.provider||"None"} · {status?.joins?.image?.engine||"Not joined"}</p>
    </div> : <>
      <label>Image provider
        <select disabled={busy||!eligibleOptions.length} value={active}
          onChange={e=>{setRoute(e.target.value);setNotice("");}}>
          {!eligibleOptions.length?<option value="">No providers registered for this mode</option>:null}
          {eligibleOptions.map(([id,o])=><option key={id} value={id}>{id} · {o.model||"No model"} · {o.ready?"Verified":"Needs test"}</option>)}
        </select></label>
      <p>Provider: {active||"Unavailable"} · {routeReady?"Verified and ready":activeOption?.configured?"Test required":"Setup required"} · {activeOption?.cost||"See provider terms"}</p>
      {!routeReady&&activeOption?.error?<p className={styles.blocked}>{activeOption.error}</p>:null}
      <button type="button" disabled={busy||!capable} onClick={()=>setStage("preview")}>Review Switch + Test</button>
      {stage==="preview"&&activeOption?<section className={styles.preview} aria-label="Review image route change">
        <strong>Confirm {active} as your image route</strong>
        <p>Previous provider: {selected||"none"}. {routeReady?"Previously verified; selection needs no inference call.":"A capability test will run before the active provider is changed."}</p>
        {cloud?<><p>Paid cloud tests and image generation may incur provider charges. Character prompts and authorized reference images may leave this computer. No screenplay or media is uploaded by opening this panel.</p>
          <label><input type="checkbox" checked={charges} onChange={e=>setCharges(e.target.checked)} /> Authorize this provider test's charges</label>
          <label><input type="checkbox" checked={share} onChange={e=>setShare(e.target.checked)} /> Authorize sending the test prompt to the cloud provider</label>
        </>:<p>Local route selected; no paid provider inference is authorized.</p>}
        <div className={styles.actions}><button type="button" disabled={busy||(cloud&&(!charges||!share))} onClick={()=>void confirm()}>{busy?"Checking…":"Confirm, Test if needed & Switch"}</button>
          <button type="button" disabled={busy} onClick={()=>setStage("idle")}>Cancel</button></div>
      </section>:null}
    </>}
    {notice?<p className={styles.notice} role="status" aria-live="polite">{notice}</p>:null}
  </section>;
}
