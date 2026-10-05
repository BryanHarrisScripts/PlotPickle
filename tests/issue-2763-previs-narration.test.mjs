import test from 'node:test';
import assert from 'node:assert/strict';
import { narrationRequest, narrationPrompt, parseNarration } from '../core/media/previs-narration.mjs';
const input = narrationRequest({passages:[{type:'character',text:'REN'},{type:'dialogue',text:'We should go.'}],panels:[{position:1,intention:'Ren pauses at the door.'},{position:2,intention:'Ren leaves.'}]});
test('narration preserves ordered locked positions and permits silent panels',()=>{
 const panels=parseNarration(JSON.stringify({panels:[{position:1,narration:'Ren hesitates.',bubbles:[{speaker:'REN',text:'We should go.'}]},{position:2,narration:'',bubbles:[]}]}),input);
 assert.equal(panels[1].narration,''); assert.equal(panels[0].bubbles[0].speaker,'REN');
});
test('reject missing script, duplicate positions, unknown speakers, oversized text and incomplete output',()=>{
 assert.throws(()=>narrationRequest({passages:[],panels:input.panels}));
 assert.throws(()=>narrationRequest({passages:input.passages,panels:[input.panels[0],input.panels[0]]}));
 const valid=[{position:1,narration:'',bubbles:[]},{position:2,narration:'',bubbles:[]}];
 for (const panels of [valid.slice(0,1),[valid[1],valid[0]],[{...valid[0],bubbles:[{speaker:'INVENTED',text:'Hello'}]},valid[1]],[{...valid[0],narration:'x'.repeat(141)},valid[1]]]) assert.throws(()=>parseNarration(JSON.stringify({panels}),input));
 assert.match(narrationPrompt(input),/ONE continuous/); assert.match(narrationPrompt(input),/silent panels/);
});
