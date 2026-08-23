import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { enrichedVerificationRecord } from "./verification-companions";

const API = "/api/verification-inbox";
function local(request: IncomingMessage) { const address=request.socket.remoteAddress||""; return ["127.0.0.1","::1","::ffff:127.0.0.1"].includes(address)&&/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(request.headers.host||""); }
function send(response:ServerResponse,status:number,body:Record<string,unknown>){response.statusCode=status;response.setHeader("Content-Type","application/json; charset=utf-8");response.setHeader("Cache-Control","no-store");response.end(JSON.stringify(body));}

export function registerVerificationOrchestrationGateway(server:ViteDevServer){server.middlewares.use((request,response,next)=>{const raw=request.url;if(!raw){next();return;}let url:URL;try{url=new URL(raw,"http://127.0.0.1");}catch{next();return;}const runId=url.searchParams.get("runId")||"";if(url.pathname!==API||request.method!=="GET"||!runId){next();return;}if(!local(request)){send(response,403,{ok:false,message:"Verification review is local-only."});return;}void enrichedVerificationRecord(runId).then((result)=>{if(result.status!==200){send(response,result.status,{ok:false,message:result.message});return;}send(response,200,{ok:true,record:result.record});}).catch(()=>send(response,500,{ok:false,message:"Verification review companions could not be read."}));});}
