/** Read-only World environment target projection from the selected Library PPF.
 * Never invents a location or promotes screenplay headings to accepted canon.
 */
export function worldEnvironmentSources(project) {
  const passages=Array.isArray(project?.sourceEvidence?.screenplay?.passages)
    ? project.sourceEvidence.screenplay.passages : [];
  const seen=new Set();
  const result=[];
  for(const passage of passages){
    const raw=typeof passage?.text==="string"?passage.text.trim():"";
    const valid=passage?.type==="scene-heading" || passage?.type==="scene" ||
      /^(?:INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)\s/iu.test(raw);
    if(!raw||!valid||typeof passage?.id!=="string"||!passage.id)continue;
    const label=raw.replace(/\s+/gu," ").slice(0,200);
    const identity=label.toLowerCase();
    if(seen.has(identity))continue;
    seen.add(identity);
    result.push({id:passage.id,label,text:raw,kind:"screenplay-location"});
    if(result.length>=120)break;
  }
  const brief=project?.world?.brief;
  if(typeof brief?.savedAt==="string"&&brief.savedAt
    &&typeof brief?.content==="string"&&brief.content.trim()){
    result.push({id:"saved-world-brief",label:"Saved World description",
      text:brief.content.trim().slice(0,2400),kind:"world-brief"});
  }
  return result;
}
