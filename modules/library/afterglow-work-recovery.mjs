/**
 * #2863 - read-only recovery inventory for the actual saved creative work.
 *
 * This is a discovery view, NOT an alternate consolidation engine or a commit
 * authorization. Keep the original snapshots, accepted/proposed distinction,
 * canonical field identity and source provenance intact.
 */
const record = value => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const string = value => typeof value === "string" ? value.trim() : "";
const entries = value => Object.entries(record(value));
const groups = [
  {id:"genres",label:"Genres and tropes"},
  {id:"world",label:"World-building"},
  {id:"story-bible",label:"Story Bible"},
  {id:"character",label:"Character development"},
  {id:"foundations",label:"Foundations"},
  {id:"other",label:"Other Mind Map answers"},
  {id:"notes",label:"Human working notes (not story canon)"},
  {id:"visuals",label:"Character images and locks (media not verified)"},
];

function groupFor(field) {
  if (field.topicId === "world" && field.lessonId === "genres") return "genres";
  if (field.topicId === "world" && field.lessonId === "story-bible") return "story-bible";
  if (field.topicId === "world") return "world";
  if (field.topicId === "character") return "character";
  if (field.topicId === "foundations") return "foundations";
  return "other";
}
function rootAnswer(project, field) {
  if (field.topicId !== "world" && field.topicId !== "foundations") return "";
  return string(project?.[field.topicId]?.lessons?.[field.lessonId]?.answers?.[field.fieldId]);
}
function fieldState(project, id) {
  return record(project?.storyDevelopment?.fields?.[id]);
}
function keyLabel(field, key) {
  const suffix = key.slice(field.canonicalId.length);
  return field.lessonTitle + (suffix ? " · " + suffix.replace(/^::/, "").replaceAll("-", " ") : "");
}
function valueSignature(value) { return string(value); }

/**
 * Inspect all N authenticated, already-loaded saved snapshots without mutating
 * any project. Report only work different from the installed reference.
 * A draft Agent proposal is never presented as an accepted answer.
 */
export function inventoryAfterglowRecoveredWork({baseline,sources,fields}) {
  if (!baseline || !Array.isArray(sources) || !Array.isArray(fields)) {
    throw new Error("Recovery inventory requires the provided example, saved copies and canonical Mind Map definitions.");
  }
  const seen = new Set();
  for (const entry of sources) {
    if (!entry?.project || typeof entry.project.id !== "string" || seen.has(entry.project.id)) {
      throw new Error("Recovery inventory cannot inspect a duplicate or unidentified saved copy.");
    }
    seen.add(entry.project.id);
  }

  const inventory = new Map();
  function add(groupId,id,label,kind,value,project) {
    const text = valueSignature(value);
    if (!text) return;
    const unique = groupId + "|" + kind + "|" + id;
    if (!inventory.has(unique)) inventory.set(unique,{
      groupId,id,label,kind,alternatives:[],
    });
    const row = inventory.get(unique);
    let alternative = row.alternatives.find(item => item.text === text);
    if (!alternative) {
      alternative = {text,sources:[]};
      row.alternatives.push(alternative);
    }
    if (!alternative.sources.some(item => item.id === project.id)) {
      alternative.sources.push({id:project.id,updatedAt:project.updatedAt});
    }
  }

  const definitions = new Map(fields.map(field=>[field.canonicalId,field]));
  const allStates = sources.flatMap(entry=>Object.keys(record(entry.project.storyDevelopment?.fields)));
  const allKeys = new Set(allStates);
  const knownKeys = new Set();

  for (const field of fields) {
    const category = groupFor(field);
    // Foundations and World answers live in their existing truth stores,
    // not in storyDevelopment.fields.value (which can be blank metadata).
    if (field.topicId === "world" || field.topicId === "foundations") {
      const original = rootAnswer(baseline,field);
      for (const {project} of sources) {
        const value = rootAnswer(project,field);
        if (value && value !== original) {
          add(category,field.canonicalId,keyLabel(field,field.canonicalId),"saved-answer",value,project);
        }
      }
    }
    for (const key of allKeys) {
      if (key !== field.canonicalId && !key.startsWith(field.canonicalId+"::")) continue;
      knownKeys.add(key);
      const baselineState = fieldState(baseline,key);
      for (const {project} of sources) {
        const current = fieldState(project,key);
        const savedValue = string(current.value);
        const originalValue = string(baselineState.value);
        // Project-wide World/Foundations values come from their canonical
        // lesson answers above; scoped overrides do live here.
        if (savedValue && savedValue !== originalValue
          && (key !== field.canonicalId || !["world","foundations"].includes(field.topicId))) {
          add(category,key,keyLabel(field,key),"saved-answer",savedValue,project);
        }
        const proposal = string(current.proposal);
        if (proposal && proposal !== string(baselineState.proposal)) {
          add(category,key,keyLabel(field,key),"unaccepted-agent-suggestion",proposal,project);
        }
      }
    }
  }

  // Do not discard legacy/renamed keys just because the current curriculum
  // cannot identify their original question. Surface them as unknown instead.
  for (const key of allKeys) {
    if (knownKeys.has(key) || definitions.has(key)) continue;
    const original = fieldState(baseline,key);
    for (const {project} of sources) {
      const value = fieldState(project,key);
      if (string(value.value) && string(value.value) !== string(original.value)) {
        add("other",key,"Saved field (question not identified): "+key,"unknown-field-answer",value.value,project);
      }
      if (string(value.proposal) && string(value.proposal) !== string(original.proposal)) {
        add("other",key,"Saved Agent suggestion (question not identified): "+key,"unaccepted-agent-suggestion",value.proposal,project);
      }
    }
  }

  for (const domain of ["fields","topics"]) {
    const noteIds = new Set(sources.flatMap(({project})=>Object.keys(record(project.mindMapNotes?.[domain]))));
    for (const id of noteIds) {
      const baselineText = string(baseline.mindMapNotes?.[domain]?.[id]?.text);
      for (const {project} of sources) {
        const text = string(project.mindMapNotes?.[domain]?.[id]?.text);
        if (text && text !== baselineText) {
          add("notes",domain+":"+id,(domain === "fields" ? "Field note: " : "Topic note: ")+id,
            "human-note",text,project);
        }
      }
    }
  }

  const priorArtwork = new Map((baseline.worldMap?.characterVisuals ?? []).map(item=>[item.characterId,item]));
  for (const {project} of sources) {
    for (const character of project.worldMap?.characterVisuals ?? []) {
      const original = priorArtwork.get(character.characterId);
      const oldReferences = new Map((original?.references ?? []).map(ref=>[ref.id,ref]));
      for (const ref of character.references ?? []) {
        const prior = oldReferences.get(ref.id);
        if (prior && prior.assetUrl === ref.assetUrl && prior.reviewState === ref.reviewState
          && prior.versionId === ref.versionId) continue;
        add("visuals",character.characterId+":"+ref.id,
          character.characterName+" · "+ref.view,"saved-image-reference",
          ref.reviewState+" · "+ref.assetUrl,project);
      }
      if (character.lockedVersionId && character.lockedVersionId !== original?.lockedVersionId) {
        add("visuals",character.characterId+":lock",
          character.characterName+" · saved lock","saved-image-lock",character.lockedVersionId,project);
      }
    }
  }

  const resultGroups = groups.map(group=>({
    ...group,
    items:[...inventory.values()].filter(item=>item.groupId===group.id)
      .sort((a,b)=>a.label.localeCompare(b.label)||a.id.localeCompare(b.id)),
  }));
  return {
    sourceCount:sources.length,
    recoveredItemCount:inventory.size,
    differingValueCount:[...inventory.values()].filter(item=>item.alternatives.length>1).length,
    groups:resultGroups,
    packageModified:false,
    readyForHumanCommit:false,
  };
}
