"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = "/api/playhouse-federation";
type State = { identity?: { configured?: boolean; displayName?: string; studioId?: string }; presence?: { availability?: string; visibility?: string; announcedAt?: string; withdrawnAt?: string; lastTransportError?: string }; message?: string };

export default function PlayhousePresencePage() {
  const [state,setState]=useState<State>({}); const [availability,setAvailability]=useState("online"); const [visibility,setVisibility]=useState("contacts"); const [busy,setBusy]=useState(""); const [notice,setNotice]=useState("");
  async function call(action?:string){const response=await fetch(API,action?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,availability,visibility,publicRooms:["great-hall"],agents:[]})}:undefined);const body=await response.json() as State;if(!response.ok)throw new Error(body.message||"Playhouse federation request failed.");return body;}
  useEffect(()=>{void call().then((value)=>{setState(value);setAvailability(value.presence?.availability||"online");setVisibility(value.presence?.visibility||"contacts");}).catch((error)=>setNotice(error.message));},[]);
  async function run(action:"announce"|"withdraw"|"test"){setBusy(action);setNotice("");try{const next=await call(action);setState(next);setNotice(action==="announce"?"Studio presence was signed and announced through BUZZ.":action==="withdraw"?"Studio presence was cleanly withdrawn through BUZZ.":"A signed Studio-to-Studio transport test event was sent through BUZZ.");}catch(error){setNotice(`${error instanceof Error?error.message:"BUZZ transport failed."} Local PlotPickle creative work remains available.`);}finally{setBusy("");}}
  return <main style={{maxWidth:900,margin:"0 auto",padding:"34px 24px",color:"#eee9df"}}>
    <p><Link href="/studio-identity">Studio Identity</Link> / Playhouse Presence</p><h1>Join the Playhouse without exposing this Studio&apos;s local server.</h1>
    <p>PlotPickle sends only a signed minimal presence envelope through your existing outbound BUZZ connection. PPF projects, local files, prompts, model inventory, usernames and machine details are not part of this payload.</p>
    {!state.identity?.configured?<p>Create a <Link href="/studio-identity">Studio Identity</Link> first.</p>:<section><h2>{state.identity.displayName}</h2><p>{state.identity.studioId}</p><label>Availability <select value={availability} onChange={(e)=>setAvailability(e.target.value)}><option value="online">Online</option><option value="away">Away</option><option value="offline">Offline</option></select></label>{" "}<label>Visibility <select value={visibility} onChange={(e)=>setVisibility(e.target.value)}><option value="public">Public</option><option value="contacts">Contacts / Guilds</option><option value="invisible">Invisible</option></select></label><div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}><button disabled={Boolean(busy)} onClick={()=>void run("announce")}>{busy==="announce"?"Announcing…":"Announce presence"}</button><button disabled={Boolean(busy)} onClick={()=>void run("withdraw")}>{busy==="withdraw"?"Withdrawing…":"Withdraw presence"}</button><button disabled={Boolean(busy)} onClick={()=>void run("test")}>{busy==="test"?"Testing…":"Send signed transport test"}</button></div><p>Last announced: {state.presence?.announcedAt||"Not yet"} · Last withdrawn: {state.presence?.withdrawnAt||"Not yet"}</p></section>}
    {notice?<p role="status">{notice}</p>:null}<footer style={{marginTop:24}}><Link href="/?workspace=community">Open Community</Link></footer>
  </main>;
}
