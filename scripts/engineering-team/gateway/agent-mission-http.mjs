/**
 * #3355: Existing local profile boundary owns authentication, not this module.
 * A mission is only a durable HUMAN DRAFT; this route does not delegate.
 */
import {createHash} from "node:crypto";
import {gatewayAppSource, privateGatewayRoot} from "./gateway-host.mjs";
import {createAgentMission, readLatestAgentMission} from "./agent-mission-store.mjs";

const LOOPBACK = new Set(["127.0.0.1","localhost","[::1]"]);
const json=(value,status=200)=>Response.json(value,{status,headers:{
  "Cache-Control":"no-store","Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff",
}});
const denied=code=>json({code,delegated:false,modelInvoked:false,
  releaseAuthorized:false},403);
export async function dispatchAgentMissionRequest({
  request,authorize,source=gatewayAppSource,root=privateGatewayRoot(),
  platform=process.platform,now=Date.now(),
}={}){
  const mutation=request?.method==="POST";
  if(request?.method!=="GET"&&!mutation)return json({code:"METHOD_NOT_ALLOWED"},405);
  let url;
  try{url=new URL(request.url);}catch{return denied("LOCAL_WINDOWS_ONLY");}
  const origin=request.headers.get("origin");
  if(platform!=="win32"||url.protocol!=="http:"||!LOOPBACK.has(url.hostname)||
     url.pathname!=="/api/factory/mission"||url.search||url.hash||
     url.username||url.password||(origin&&origin!==url.origin)||
     (mutation&&(!origin||origin!==url.origin||
       (request.headers.get("sec-fetch-site")&&
         request.headers.get("sec-fetch-site")!=="same-origin")||
       request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")))
    return denied("LOCAL_WINDOWS_ONLY");
  let principal;
  try{principal=await authorize(request,mutation);}catch{return denied("PROFILE_SESSION_REQUIRED");}
  // Never use a browser/model-supplied identity to select private storage.
  if(!principal||typeof principal.profileId!=="string"||
     principal.profileId.length<1||principal.profileId.length>128||
     typeof principal.nodeId!=="string"||principal.nodeId.length<1||
     principal.nodeId.length>128)
    return denied("PROFILE_IDENTITY_UNVERIFIED");
  const current=await source();
  if(!current||!/^[a-f0-9]{40}$/.test(current.head||"")||
      !["main","candidate"].includes(current.channel))
    return json({code:"MISSION_SOURCE_UNVERIFIED"},409);
  const scope=createHash("sha256").update("plotpickle.agent-mission.v1\0")
    .update(principal.nodeId).update("\0").update(principal.profileId)
    .digest("hex");
  const authorization={
    verified:true,profileScopeDigest:scope,sourceHead:current.head,
    sourceChannel:current.channel,expiresAt:now+30_000,
    permittedOperations:[mutation?"mission.create":"mission.read"],
  };
  if(!mutation){
    const result=await readLatestAgentMission({root,source:current,
      authorization,now});
    return json(result,result.code.endsWith("_UNVERIFIED")?409:200);
  }
  const length=Number(request.headers.get("content-length")||"0");
  if(!Number.isFinite(length)||length<0||length>512)
    return json({code:"MISSION_REQUEST_INVALID"},400);
  let body;
  try{
    const raw=await request.text();
    if(Buffer.byteLength(raw,"utf8")>512)throw Error("too large");
    body=JSON.parse(raw);
  }catch{return json({code:"MISSION_REQUEST_INVALID"},400);}
  if(!body||typeof body!=="object"||Array.isArray(body)||
      Object.keys(body).length!==2||body.action!=="create-draft"||
      typeof body.goal!=="string")
    return json({code:"MISSION_ACTION_NOT_AUTHORIZED"},400);
  const result=await createAgentMission({root,source:current,
    authorization,goal:body.goal,now});
  return json(result,result.code==="MISSION_DRAFT"?201:409);
}
