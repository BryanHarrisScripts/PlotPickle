/**
 * #3220: bounded owner-Windows PlotPickle application lifecycle, independent
 * of the Software Factory queue and of PR-candidate source execution.
 *
 * Exactly the paired MCP process's own child may be stopped. A process left
 * running after tunnel restart is foreign/unverified and is NEVER adopted.
 * This is not a general process manager, arbitrary command gateway or proof
 * of Human browser UAT.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { terminateVerificationProcessTree } from "../../full-verification-process.mjs";
import { readFactoryVerificationHead } from "./factory-named-tests.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SHA = /^[0-9a-f]{40}$/u;
const HOST = "127.0.0.1";
const PORT = 4173;
const START_TIMEOUT_MS = 65_000;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const alive = child => child?.pid > 0 && child.exitCode === null && child.signalCode === null;
const result = (state,code,sourceHead=null) => Object.freeze({
  state,code,sourceHead,modelInvoked:false,issueReserved:false,
  independentVerification:false,
});

/** A denied/uncertain connect is treated as occupied; do not seize foreign ports. */
export async function plotpickleAppPortOccupied() {
  return new Promise(resolve => {
    const socket=net.connect({host:HOST,port:PORT});
    let settled=false;
    const finish=value => {
      if(settled)return;
      settled=true;clearTimeout(timer);socket.destroy();resolve(value);
    };
    const timer=setTimeout(()=>finish(true),1500);
    socket.once("connect",()=>finish(true));
    socket.once("error",error=>finish(error?.code!=="ECONNREFUSED"));
  });
}

/** Identity, not merely an HTTP 200, is required before reporting ready. */
export async function probePlotpickleApp(expectedHead) {
  const marker=`plotpickle-startup-v4-${expectedHead}-normal-local-human-vite-source`;
  try{
    const response=await fetch(`http://${HOST}:${PORT}/skin-v1`,{
      cache:"no-store",signal:AbortSignal.timeout(4000),
      headers:{"X-PlotPickle-Startup-Probe":"mcp-owner-app-control"},
    });
    if(!response.ok)return false;
    const body=await response.text();
    return body.includes(marker)&&/PlotPickle/i.test(body);
  }catch{return false;}
}

export function createPlotpickleAppController({
  repoRoot=ROOT,platform=process.platform,verifyHead=readFactoryVerificationHead,
  launch=spawn,portOccupied=plotpickleAppPortOccupied,
  probe=probePlotpickleApp,stopTree=terminateVerificationProcessTree,
  hasFile=existsSync,delay=pause,now=Date.now,startTimeoutMs=START_TIMEOUT_MS,
}={}) {
  // An ephemeral child handle is the sole STOP authority. Never read a PID
  // from an MCP argument, lock file, task listing, or arbitrary TCP listener.
  let owned=null;
  let busy=false;

  async function headIs(expectedHead){
    if(!SHA.test(expectedHead||""))return false;
    try{return await verifyHead({repoRoot})===expectedHead;}
    catch{return false;}
  }
  async function stopping(expectedHead) {
    if(!owned || owned.head!==expectedHead || !alive(owned.child))
      return result("BLOCKED","APP_PROCESS_NOT_OWNED",expectedHead);
    try{await stopTree(owned.child,{stderr:{write(){}}});}
    catch{return result("BLOCKED","APP_STOP_UNVERIFIED",expectedHead);}
    if(alive(owned.child) || await portOccupied())
      return result("BLOCKED","APP_STOP_UNVERIFIED",expectedHead);
    owned=null;
    return result("TEST_PASSED","APP_STOPPED_VERIFIED",expectedHead);
  }
  async function starting(expectedHead){
    if(owned?.child && alive(owned.child))
      return result("BLOCKED","APP_ALREADY_RUNNING_OWNED",expectedHead);
    // Even a child that just exited cannot authorize occupying a foreign port.
    if(await portOccupied())return result("BLOCKED","APP_PORT_OCCUPIED",expectedHead);
    const entry=path.join(repoRoot,"node_modules","vite","bin","vite.js");
    if(!hasFile(entry))return result("BLOCKED","APP_DEPENDENCIES_UNAVAILABLE",expectedHead);
    const env={...process.env,
      NODE_ENV:"development",
      PLOTPICKLE_STARTUP_TESTING_MODE:"normal",
      PLOTPICKLE_LAUNCH_INTENT:"local-human",
      PLOTPICKLE_STARTUP_CONTRACT:`plotpickle-startup-v4-${expectedHead}-normal-local-human-vite-source`,
    };
    // Never hand the MCP control credential to application/browser processes.
    delete env.PLOTPICKLE_FACTORY_MCP_CONTROL_TOKEN;
    let child;
    try{
      child=launch(process.execPath,[entry,"--host",HOST,"--port",String(PORT),"--strictPort"],{
        cwd:repoRoot,env,windowsHide:true,shell:false,stdio:"ignore",detached:false,
      });
    }catch{return result("BLOCKED","APP_START_FAILED",expectedHead);}
    if(!child?.pid){
      return result("BLOCKED","APP_START_FAILED",expectedHead);
    }
    // Ensure an async spawn error never terminates the MCP process.
    child.on?.("error",()=>{});
    owned={child,head:expectedHead,at:now()};
    const deadline=now()+startTimeoutMs;
    while(now()<deadline){
      if(!alive(child))return result("BLOCKED","APP_START_FAILED",expectedHead);
      if(await probe(expectedHead)){
        if(!alive(child)||!(await headIs(expectedHead))){
          const stopped=await stopping(expectedHead);
          return result("BLOCKED",stopped.code==="APP_STOPPED_VERIFIED"
            ?"APP_SOURCE_CHANGED":"APP_STOP_UNVERIFIED",expectedHead);
        }
        return result("TEST_PASSED","APP_STARTED_VERIFIED",expectedHead);
      }
      await delay(1000);
    }
    // A startup timeout is NOT a green server; best-effort owned cleanup.
    const stopped=await stopping(expectedHead);
    return result("BLOCKED",stopped.code==="APP_STOPPED_VERIFIED"
      ?"APP_START_TIMEOUT":"APP_STOP_UNVERIFIED",expectedHead);
  }
  return Object.freeze({
    async control({action,expectedHead}={}){
      if(platform!=="win32")return result("BLOCKED","WINDOWS_ONLY");
      if(!["start","stop","restart"].includes(action))
        return result("BLOCKED","APP_ACTION_INVALID");
      if(busy)return result("BLOCKED","APP_CONTROL_BUSY");
      busy=true;
      try{
        if(!(await headIs(expectedHead)))
          return result("BLOCKED","EXACT_HEAD_MISMATCH");
        if(action==="start")return await starting(expectedHead);
        if(action==="stop")return await stopping(expectedHead);
        const stop=await stopping(expectedHead);
        if(stop.state!=="TEST_PASSED")return stop;
        const start=await starting(expectedHead);
        return start.state==="TEST_PASSED"
          ?result("TEST_PASSED","APP_RESTARTED_VERIFIED",expectedHead):start;
      }finally{busy=false;}
    },
    async status(){
      const occupied=await portOccupied();
      if(owned && alive(owned.child) && occupied)
        return Object.freeze({state:"OWNED_PROCESS_OBSERVED",sourceHead:owned.head,
          ready:await probe(owned.head),ownerVerified:true,independentVerification:false});
      return Object.freeze({state:occupied?"UNOWNED_PORT_OCCUPIED":"NOT_RUNNING",
        sourceHead:null,ready:false,ownerVerified:false,independentVerification:false});
    },
  });
}

const ownerAppController=createPlotpickleAppController();
export const controlPlotpickleOwnerApp = args => ownerAppController.control(args);
export const observePlotpickleOwnerApp = () => ownerAppController.status();
