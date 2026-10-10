/** #2890: ONE profile-owned consolidation work-in-progress, not a backup list. */
const SHA = /^sha256:[a-f0-9]{64}$/;
const own = value => value!==null && typeof value==="object" && !Array.isArray(value);
const MAX_KEYS=5000, MAX_BYTES=700_000;
function pathMap(raw,label,validValue) {
  if(!own(raw) || Object.keys(raw).length>MAX_KEYS)throw new Error("Invalid "+label+" review decisions.");
  const out={};
  for(const [path,value] of Object.entries(raw)){
    if(typeof path!=="string" || !path.startsWith("/") || path.length>1024 ||
      !validValue(value))throw new Error("Invalid "+label+" review selection.");
    out[path]=value;
  }
  return out;
}
export function normalizeAfterglowReviewDraft(input,now){
  if(!own(input)||input.version!==1||typeof input.sourceFingerprint!=="string"||
    !SHA.test(input.sourceFingerprint)||!own(input.selections))
    throw new Error("Review draft must be bound to verified saved sources.");
  const original=input.selections;
  if(!Array.isArray(original.exclusions)||original.exclusions.length>MAX_KEYS)
    throw new Error("Invalid review exclusions.");
  const exclusions=original.exclusions.map(value=>{
    if(typeof value!=="string" || !value.startsWith("/") || value.length>1024)
      throw new Error("Invalid review exclusion.");
    return value;
  });
  if(new Set(exclusions).size!==exclusions.length)
    throw new Error("Duplicate review exclusion.");
  const imageChoices={};
  if(!own(original.imageChoices)||Object.keys(original.imageChoices).length>MAX_KEYS)
    throw new Error("Invalid review images.");
  for(const [key,value] of Object.entries(original.imageChoices)){
    if(typeof key!=="string"||!key||key.length>1024||(value!=="keep"&&value!=="exclude"))
      throw new Error("Invalid image version selection.");
    imageChoices[key]=value;
  }
  const decisions=pathMap(original.decisions,"alternative",
    v=>v==="baseline"||(Number.isInteger(v)&&v>=0&&v<5000));
  const confirmedCurrent=pathMap(original.confirmedCurrent,"confirmation",v=>v===true);
  const result={version:1,sourceFingerprint:input.sourceFingerprint,
    selections:{decisions,exclusions,imageChoices,confirmedCurrent},
    savedAt: typeof now==="string"&&Number.isFinite(Date.parse(now))?now:new Date().toISOString()};
  if(Buffer.byteLength(JSON.stringify(result),"utf8")>MAX_BYTES)
    throw new Error("Review choices exceed the allowed draft size.");
  return result;
}
