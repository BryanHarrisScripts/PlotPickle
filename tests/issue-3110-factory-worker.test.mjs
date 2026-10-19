import test from "node:test";
import assert from "node:assert/strict";
import { selectFactoryIssue, admissionRecord } from "../scripts/engineering-team/windows/factory-worker.mjs";
const H="a".repeat(40),L="plotpickle:factory-ready";
test("only explicitly ready non-held open issues can enter queue",()=>{
 const list=[
  {number:4,state:"open",labels:[{name:"hold"},{name:L}]},
  {number:3,state:"closed",labels:[{name:L}]},
  {number:10,state:"open",labels:[{name:L}]},
  {number:2,state:"open",labels:[]},
  {number:9,state:"open",labels:[L]},
 ];
 assert.equal(selectFactoryIssue(list).number,9);
 assert.equal(selectFactoryIssue(list,[9]).number,10);
 assert.equal(selectFactoryIssue(list,[9,10]),null);
});
test("admission is stable exact-head and refuses patch/merge authority",()=>{
 const a=admissionRecord({number:3123},H,0);
 assert.equal(a.id,admissionRecord({number:3123},H,100).id);
 assert.equal(a.state,"WAITING_FOR_IMPLEMENTER");
 assert.equal(a.modelDispatchAllowed,false);
 assert.equal(a.sourceMutationAllowed,false);
 assert.equal(a.mergeEligible,false);
 assert.equal(a.independentVerification,false);
 assert.notEqual(a.id,admissionRecord({number:3123},"b".repeat(40),0).id);
 assert.throws(()=>admissionRecord({number:"../../etc"},H));
 assert.throws(()=>admissionRecord({number:1},"main"));
});
