/** Explicit source-bound inclusion decisions. Never writes source snapshots. */
import {readAfterglowRecordPath,writeAfterglowRecordPath,AFTERGLOW_DURABLE_FIELDS} from './afterglow-consolidation.mjs';
const prefix='/afterglow-record-review';
export const isAfterglowRecordDecision=key=>key.startsWith(prefix+'/');
export const afterglowRecordDecisionKey=path=>prefix+path;
export const afterglowCreativeDecisions=decisions=>Object.fromEntries(Object.entries(decisions).filter(([key])=>!isAfterglowRecordDecision(key)));
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'
 ?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}':JSON.stringify(value);
const visual=/^\/build\/(foundations|world)\/visualArtifacts\/(@id:[^/]+)/;
const character=/^\/worldMap\/characterVisuals\/@character:[^/]+/;
const creative=path=>/^\/(foundations|world)\/lessons\/[^/]+\/answers\//.test(path)
 ||/^\/(storyDevelopment\/fields|mindMapNotes\/(fields|topics))\//.test(path)
 ||/^\/production\/graphicNovelTextApprovals\//.test(path);
const owner=path=>visual.exec(path)?.[0]??character.exec(path)?.[0]
 ??/^\/production\/timelineMotionShots\/@id:[^/]+/.exec(path)?.[0]??path;
const labelFor=(path,value)=>{
 if(path==='/learning/activeLessonId')return 'Lesson to resume';
 if(character.test(path))return 'Saved character images: '+(value.characterName??value.characterId);
 if(path.startsWith('/production/timelineMotionShots/'))return 'Motion shot '+(value.shotNumber??'')+' '+(value.prompt??value.id);
 if(path.endsWith('/updatedAt'))return 'Saved time: '+path.split('/').at(-2).replaceAll('-',' ');
 return path.replaceAll('/',' / ').replace(/@(?:id|character):/g,'');
};
const covers=(parent,child)=>parent===child||child.startsWith(parent+'/');
function mediaPaths(value,path='',entityPath=null,out=[]){
 if(typeof value==='string'&&/^\/(api\/local-ai\/assets|assets\/library\/examples)\//.test(value))out.push(entityPath??owner(path));
 else if(Array.isArray(value))for(const item of value){
   if(!item||typeof item!=='object')continue;
   const id=typeof item.id==='string'?'id:'+item.id:typeof item.characterId==='string'?'character:'+item.characterId:null;
   if(id){const next=path+'/@'+id.replaceAll('~','~0').replaceAll('/','~1');mediaPaths(item,next,owner(next),out);}
 }else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))mediaPaths(item,path+'/'+key.replaceAll('~','~0').replaceAll('/','~1'),entityPath,out);
 return out;
}
export function listAfterglowReviewRecords({baseline,sources,plan}){
 const entries=[{key:'provided-example',label:'Provided example',project:baseline},...sources.map(source=>({
   key:source.sourceKey??source.project.id,label:(source.savedAt??source.project.updatedAt)+' · revision '+source.project.revision,project:source.project,
 })).sort((a,b)=>a.key.localeCompare(b.key))];
 const paths=new Set([...plan.applied,...plan.conflicts,...plan.needsReview].map(item=>owner(item.path)));
 for(const entry of entries){
   for(const scope of ['foundations','world'])for(const artifact of entry.project.build?.[scope]?.visualArtifacts??[])
     paths.add('/build/'+scope+'/visualArtifacts/@id:'+artifact.id.replaceAll('~','~0').replaceAll('/','~1'));
   for(const pack of entry.project.worldMap?.characterVisuals??[])paths.add('/worldMap/characterVisuals/@character:'+pack.characterId.replaceAll('~','~0').replaceAll('/','~1'));
   for(const root of AFTERGLOW_DURABLE_FIELDS)for(const path of mediaPaths(entry.project[root],'/'+root))paths.add(owner(path));
 }
 const structural=[...plan.conflicts,...plan.needsReview];
 const eligible=[...paths].filter(path=>(!character.test(path)||structural.some(item=>covers(path,item.path)))&&!/^\/build\/(foundations|world)\/visualArtifacts$/.test(path)&&path!=='/worldMap/characterVisuals'&&!creative(path)&&!/^\/build\/(foundations|world)\/acceptedVisualArtifactIds(?:\/|$)/.test(path)
   &&!covers('/sourceEvidence/referenceFixture',path));
 return eligible.filter(path=>!eligible.some(other=>other!==path&&covers(other,path))).sort().flatMap(path=>{
   const versions=[],index=new Map();
   for(const entry of entries){
     const record=readAfterglowRecordPath(entry.project,path);if(!record.present)continue;
     const match=visual.exec(path),id=match?path.split('/@id:')[1].replaceAll('~1','/').replaceAll('~0','~'):null;
     const accepted=match?(entry.project.build?.[match[1]]?.acceptedVisualArtifactIds??[]).includes(id):undefined;
     const signature=stable({value:record.value,accepted});
     if(index.has(signature)){versions[index.get(signature)].sources.push(entry.label);continue;}
     index.set(signature,versions.length);versions.push({value:record.value,accepted,sources:[entry.label]});
   }
   if(!versions.length)return [];
   const value=versions[0].value;
   const image=Boolean(value&&typeof value==='object'&&typeof value.assetUrl==='string');
   return [{key:afterglowRecordDecisionKey(path),path,kind:image?'image':'record',
     label:image?(value.narrativeIntention??'Saved image'):labelFor(path,value),versions}];
 });
}
export function applyAfterglowRecordChoices({baseline,sources,plan,reviewed,decisions}){
 const records=listAfterglowReviewRecords({baseline,sources,plan}),index=new Map(records.map(record=>[record.key,record]));
 const candidate=structuredClone(reviewed.candidate),resolvedRecordPaths=[];
 for(const [key,choice] of Object.entries(decisions).filter(([key])=>isAfterglowRecordDecision(key))){
   const record=index.get(key);if(!record)throw new Error('Saved record selection is outside this source inventory.');
   if(choice!=='baseline'&&(!Number.isInteger(choice)||choice<0||choice>=record.versions.length))throw new Error('Saved record selection is not a recorded alternative.');
   const selected=choice==='baseline'?null:record.versions[choice];
   // Not required excludes entities/images. Required scalar schema defaults
   // revert to the provided value rather than inventing a missing field.
   const deletion=record.path.includes('/@')||record.kind==='image'?{present:false}:readAfterglowRecordPath(baseline,record.path);
   writeAfterglowRecordPath(candidate,record.path,selected?{present:true,value:selected.value}:deletion);
   const match=visual.exec(record.path);
   if(match){
     const group=candidate.build[match[1]],id=record.path.split('/@id:')[1].replaceAll('~1','/').replaceAll('~0','~');
     group.acceptedVisualArtifactIds=(group.acceptedVisualArtifactIds??[]).filter(value=>value!==id);
     if(selected?.accepted)group.acceptedVisualArtifactIds.push(id);
   }
   resolvedRecordPaths.push(record.path);
 }
 const unresolvedConflicts=reviewed.unresolvedConflicts.filter(item=>!resolvedRecordPaths.some(path=>covers(path,item.path)));
 const needsReview=reviewed.needsReview.filter(item=>!resolvedRecordPaths.some(path=>covers(path,item.path)));
 return {...reviewed,candidate,unresolvedConflicts,needsReview,resolvedRecordPaths,
   decisionShapeConsistent:!unresolvedConflicts.length&&!needsReview.length};
}
