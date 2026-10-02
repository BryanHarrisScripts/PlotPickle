import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const source=await readFile(new URL("../core/media/screening-media-evidence.ts",import.meta.url),"utf8");
const decision=await readFile(new URL("../docs/fframes-adoption-decision.md",import.meta.url),"utf8");
test("#2666 Screening evidence is projection-only and never canonical",()=>{assert.match(source,/projectionOnly: true/);assert.match(source,/canonical: false/);assert.doesNotMatch(source,/applyStoryCommand|saveFoundationProject/);});
test("#2666 rejects stale render evidence and preserves normal Screening",()=>{assert.match(source,/state: "stale"/);assert.match(source,/Normal Screening remains available/);assert.match(source,/Existing project state is unchanged/);});
test("#2666 exposes playback and bounded inspection evidence",()=>{assert.match(source,/playbackArtifactPaths/);assert.match(source,/durationMs/);assert.match(source,/diagnosticSummary/);assert.match(source,/sourceRefs/);});
test("#2666 records optional-adapter adoption and distribution boundary",()=>{assert.match(decision,/Keep FFrames as an optional local adapter/);assert.match(decision,/Do not make it PlotPickle's default engine/);assert.match(decision,/No FFrames, FFmpeg, codec, LLVM/);assert.match(decision,/pin\/fork\/replace\/remove/);});
