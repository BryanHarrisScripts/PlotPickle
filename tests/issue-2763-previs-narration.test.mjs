import test from 'node:test';
import assert from 'node:assert/strict';
import { narrationRequest, narrationPrompt, parseNarration } from '../core/media/previs-narration.mjs';
const contactSheet = 'data:image/jpeg;base64,' + Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64');
const storyContext = { title:'Afterglow',act:1,block:1,miniBlock:1,blockTitle:'Opening',dramaticResponsibility:'Establish Ren’s dilemma.' };
const input = narrationRequest({contactSheet, storyContext, passages:[{type:'character',text:'REN'},{type:'dialogue',text:'We should go.'}],panels:[{position:1,intention:'Ren pauses at the door.'},{position:2,intention:'Ren leaves.'}]});
test('narration preserves ordered locked positions and permits silent panels',()=>{
 const panels=parseNarration(JSON.stringify({panels:[{position:1,narration:'Ren hesitates.',bubbles:[{speaker:'REN',text:'We should go.'}]},{position:2,narration:'',bubbles:[]}]}),input);
 assert.equal(panels[1].narration,''); assert.equal(panels[0].bubbles[0].speaker,'REN');
});
test('reject missing script, duplicate positions, unknown speakers, oversized text and incomplete output',()=>{
 assert.throws(()=>narrationRequest({contactSheet,storyContext,passages:[],panels:input.panels}));
 assert.throws(()=>narrationRequest({contactSheet,storyContext,passages:input.passages,panels:[input.panels[0],input.panels[0]]}));
 assert.throws(()=>narrationRequest({contactSheet:'data:image/jpeg;base64,AAAA',storyContext,passages:input.passages,panels:input.panels}));
 const valid=[{position:1,narration:'',bubbles:[]},{position:2,narration:'',bubbles:[]}];
 for (const panels of [valid.slice(0,1),[valid[1],valid[0]],[{...valid[0],bubbles:[{speaker:'INVENTED',text:'Hello'}]},valid[1]],[{...valid[0],narration:'x'.repeat(141)},valid[1]]]) assert.throws(()=>parseNarration(JSON.stringify({panels}),input));
 assert.match(narrationPrompt(input),/ONE continuous/); assert.match(narrationPrompt(input),/silent panels/);
 assert.match(narrationPrompt(input),/inspect the actual images/);
 assert.doesNotMatch(narrationPrompt(input),/base64/u);
});
test('narration submits approved images to the Mastra agent and distinguishes provider errors', async()=>{
 const {readFile} = await import('node:fs/promises');
 const workspace = await readFile(new URL('../app/_components/previs/previs-readiness-workspace.tsx',import.meta.url),'utf8');
 const route = await readFile(new URL('../app/api/previs/narration/route.ts',import.meta.url),'utf8');
 const runtime = await readFile(new URL('../build/mastra-agent-runtime.ts',import.meta.url),'utf8');
 assert.match(workspace,/lockedImageContactSheet\(missingPanels, controller\.signal\)/u);
 assert.match(workspace,/contactSheet, storyContext, passages:/u);
 assert.match(route,/image:input\.image/u);
 assert.match(route,/image-capable model/u);
 assert.match(runtime,/type: "image" as const, image: input\.image/u);
});
