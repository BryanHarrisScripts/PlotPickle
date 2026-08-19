import assert from "node:assert/strict";
import test from "node:test";
import {createRuntimeManifest,deriveRuntimeReadiness} from "../core/runtime/runtime-manifest-core.mjs";

function manifest(overrides={}){return createRuntimeManifest({version:1,components:[{id:"comfyui",version:"0.3.50",launchStrategy:"bundled-sidecar",platforms:["windows-x64"],stagePath:"runtime/comfyui",health:{kind:"composite",endpoint:"http://127.0.0.1:8188/system_stats",readyWhen:"process plus model/workflow readiness",timeoutMs:5000},dependencies:[],startupTimeoutMs:60000,shutdown:{kind:"process-exit",timeoutMs:10000},restartPolicy:"on-failure",capabilities:["image"],updatePolicy:"pinned",source:"upstream ComfyUI release",license:"GPL-3.0",noticeRequired:true,sha256:"a".repeat(64),developerOverrideAllowed:true,loopbackOnly:true,...overrides}]})}

test("runtime manifest pins bundled sidecars and accepts loopback composite readiness",()=>{const value=manifest();assert.equal(value.components[0].sha256,"a".repeat(64));assert.equal(value.components[0].health.kind,"composite");assert.equal(value.components[0].loopbackOnly,true)});

test("runtime manifest rejects unpinned bundled sidecars, remote health endpoints and unknown dependencies",()=>{assert.throws(()=>manifest({sha256:""}),/SHA-256/i);assert.throws(()=>manifest({health:{kind:"http",endpoint:"http://192.168.1.20:8188",timeoutMs:5000}}),/loopback-only/i);assert.throws(()=>manifest({dependencies:["missing-runtime"]}),/Unknown runtime dependency/i)});

test("process-running and capability-ready remain distinct truthful states",()=>{assert.equal(deriveRuntimeReadiness("running","starting"),"running");assert.equal(deriveRuntimeReadiness("running","ready"),"ready");assert.equal(deriveRuntimeReadiness("running","failed"),"degraded");assert.equal(deriveRuntimeReadiness("failed","ready"),"failed")});

test("runtime manifest refuses credential material",()=>{assert.throws(()=>manifest({source:"api_key=supersecret"}),/credentials/i)});
