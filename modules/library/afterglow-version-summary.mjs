/**
 * Read-only, per-snapshot summary using the same canonical Mind Map field
 * definitions and field context projection as the actual authoring surface.
 * Never confuse an unaccepted Agent suggestion with a saved project answer.
 */
const obj = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const valueText = value => typeof value === "string" ? value.trim() : "";

export function summarizeAfterglowSavedVersion({project,fields,contextForField}) {
  if (!project || !Array.isArray(fields) || typeof contextForField !== "function") {
    throw new Error("Per-version summary needs the saved project and actual Mind Map field/context definitions.");
  }
  const states=obj(project.storyDevelopment?.fields);
  const topics = new Map();
  const contextIds = new Set();
  let completedFields=0;

  for (const field of fields) {
    const canonicalId=field?.canonicalId;
    if (typeof canonicalId !== "string" || !canonicalId
      || typeof field.topicId !== "string") throw new Error("Canonical Mind Map field definition is invalid.");
    const direct = ["foundations","world"].includes(field.topicId)
      ? valueText(project[field.topicId]?.lessons?.[field.lessonId]?.answers?.[field.fieldId])
      : valueText(states[canonicalId]?.value);
    const scoped = Object.entries(states).some(([id,state]) =>
      id.startsWith(canonicalId+"::") && valueText(state?.value));
    if (!direct && !scoped) continue;

    completedFields++;
    topics.set(field.topicId,(topics.get(field.topicId)??0)+1);
    const validActs=Array.isArray(field.validActs) && field.validActs.length ? field.validActs : [1];
    const acts=field.scope==="project-wide" ? validActs.slice(0,1) : validActs;
    for (const act of acts) {
      const items=contextForField(field,act);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (typeof item?.id==="string" && item.id && valueText(item.text)) contextIds.add(item.id);
      }
    }
  }

  const notes=[...Object.values(obj(project.mindMapNotes?.fields)),
    ...Object.values(obj(project.mindMapNotes?.topics))]
    .filter(item=>valueText(item?.text)).length;
  const suggestions=Object.values(states).filter(item=>valueText(item?.proposal)).length;
  const breakdown=[...topics].map(([topicId,count])=>({topicId,count}))
    .sort((a,b)=>b.count-a.count || a.topicId.localeCompare(b.topicId));

  return Object.freeze({
    completedFields,
    possibleFields:fields.length,
    contextCount:contextIds.size,
    noteCount:notes,
    suggestionCount:suggestions,
    topicBreakdown:breakdown,
    readOnly:true,
  });
}
