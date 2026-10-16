/**
 * Pure, dependency-free screenplay cast extraction.
 * The caller supplies approved saved identity mappings; this code never creates canon.
 * Cues, IDs and scene numbers come only from the imported screenplay record.
 */
export function discoverScreenplayCastCandidates(passages, canonicalIds) {
  const clean = value => String(value ?? "").trim().replace(/\s+/gu, " ");
  const key = value => clean(value).toLocaleLowerCase("en-US");
  const confirmedIds = canonicalIds instanceof Map ? canonicalIds : new Map(canonicalIds ?? []);
  const named = new Map();
  for (const passage of passages ?? []) {
    if (typeof passage?.type !== "string" || passage.type.trim().toLowerCase() !== "character"
      || typeof passage.text !== "string" || typeof passage.id !== "string" || !passage.id) continue;
    let name = passage.text.trim();
    for (let n = 0; n < 4; n++) {
      const next = name.replace(/\s*\((?:V\.?O\.?|O\.?S\.?|OFF\s*SCREEN|CONT['’]?D|CONTINUED)\)\s*$/iu, "").trim();
      if (next === name) break;
      name = next;
    }
    if (!name || name.length > 100 || /[\n\r]|[{}<>]/u.test(name)
      || /^(?:INT\.|EXT\.|INT\/EXT\.|FADE\s+(?:IN|OUT)|CUT\s+TO|DISSOLVE\s+TO|THE\s+END)$/iu.test(name)) continue;
    name = clean(name);
    const normalizedName = key(name);
    const scene = Number.isInteger(passage.sceneNumber) && passage.sceneNumber >= 0 ? passage.sceneNumber : null;
    const current = named.get(normalizedName);
    if (current) {
      if (!current.passageIds.includes(passage.id)) current.passageIds.push(passage.id);
      if (scene !== null && !current.sceneNumbers.includes(scene)) current.sceneNumbers.push(scene);
    } else {
      named.set(normalizedName, {
        name, normalizedName, passageIds: [passage.id],
        sceneNumbers: scene === null ? [] : [scene],
        canonicalCharacterId: confirmedIds.get(normalizedName) ?? null,
      });
    }
  }
  return Object.freeze([...named.values()].map(item => Object.freeze({
    name: item.name, normalizedName: item.normalizedName,
    occurrenceCount: item.passageIds.length,
    passageIds: Object.freeze(item.passageIds),
    sceneNumbers: Object.freeze(item.sceneNumbers),
    canonicalCharacterId: item.canonicalCharacterId,
  })));
}
