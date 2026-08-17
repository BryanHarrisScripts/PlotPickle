import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("Playhouse federation uses the permanent Studio Ed25519 identity",async()=>{const source=await read("build/playhouse-federation.ts");assert.match(source,/readStudioSigningIdentity/);assert.match(source,/readStudioIdentity/);assert.match(source,/sign\(null/);assert.match(source,/verify\(null/);assert.match(source,/Ed25519/);assert.match(source,/studioId: identity\.studioId/);});

test("presence envelope is a minimal explicit allowlist, not private PlotPickle state",async()=>{const source=await read("build/playhouse-federation.ts");for(const field of ["studioId","displayName","availability","visibility","compatibility","publicRooms","agents","sentAt"])assert.match(source,new RegExp(field));assert.doesNotMatch(source,/PPFProject|screenplay|filesystem|localStorage|model inventory|private prompt|hidden reasoning|USERNAME|hostname/i);assert.match(source,/safeList/);});

test("federation is outbound through the existing BUZZ APIs and never exposes another local PlotPickle server",async()=>{const gateway=await read("build/playhouse-federation-gateway.ts");assert.match(gateway,/\/api\/local-buzz\/community\/status/);assert.match(gateway,/\/api\/local-buzz\/messages/);assert.match(gateway,/127\.0\.0\.1|localhost/);assert.doesNotMatch(gateway,/listen\(|createServer\(|0\.0\.0\.0/);assert.match(gateway,/localCreativeWorkAvailable: true/);});

test("presence can announce, withdraw and send a signed cross-Studio transport test",async()=>{const [source,gateway,page]=await Promise.all([read("build/playhouse-federation.ts"),read("build/playhouse-federation-gateway.ts"),read("app/playhouse-presence/page.tsx")]);assert.match(source,/studio\.presence/);assert.match(source,/studio\.withdrawn/);assert.match(source,/studio\.test/);assert.match(gateway,/action === "withdraw"/);assert.match(gateway,/action === "test"/);assert.match(page,/Announce presence/);assert.match(page,/Withdraw presence/);assert.match(page,/Send signed transport test/);});

test("federation transport remains diagnostic evidence rather than human Great Hall chatter",async()=>{const projection=await read("lib/community-conversation.ts");assert.match(projection,/PLOTPICKLE_STUDIO_EVENT/);assert.match(projection,/studio\\\.\(\?:presence\|withdrawn\|test\)/);assert.match(projection,/return true/);});

test("federation gateway is registered in the local host boundary",async()=>{const aggregate=await read("build/local-ai-gateway.ts");assert.match(aggregate,/registerPlayhouseFederationGateway/);assert.match(aggregate,/registerPlayhouseFederationGateway\(server\)/);});
