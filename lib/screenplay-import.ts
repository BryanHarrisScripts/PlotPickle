import {
  createBlankArcMatrix,
  createBlankProject,
  createBlankVoiceprint,
  type Character,
  type Location,
  type PlotPickleProject,
  type ScreenplayDocument,
  type ScreenplayDraftElement,
  type StoryBlock,
  type StoryThread,
} from "./project";
import { parseScreenplay, screenplayStats, type ScreenplayElement } from "./screenplay";

const conflictWords = /\b(?:against|attacks?|blocks?|but|cannot|conflict|danger|fails?|fight|forced|however|refuses?|struggle|threat|trapped)\b/i;
const choiceWords = /\b(?:chooses?|decides?|must|refuses?|risks?|swears?|will|won't)\b/i;
const propWords = /\b(?:bag|book|box|card|case|cell|computer|cup|document|door|file|glass|gun|key|knife|letter|map|phone|photo|ring|screen|table|tablet|ticket|tool|watch)\b/gi;
const vehicleWords = /\b(?:airplane|bike|boat|bus|car|helicopter|motorcycle|ship|train|truck|van|vehicle)\b/gi;
const effectWords = /\b(?:blood|explosion|fire|fog|glitch|hologram|rain|smoke|snow|storm|water|wind)\b/gi;
const stuntWords = /\b(?:chase|crash|fall|fight|jump|run|shoot|stunt|swim)\b/gi;

function cleanFileTitle(fileName: string) {
  return fileName
    .replace(/\.(?:txt|fountain|spmd|fdx)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Imported Screenplay";
}

function titleFromSource(screenplay: ScreenplayDocument) {
  const fountainTitle = screenplay.sourceText.match(/^Title:\s*(.+)$/im)?.[1]?.trim();
  const finalDraftTitle = screenplay.sourceText.match(/<TitlePage[\s\S]*?<Text\b[^>]*>([^<]+)<\/Text>/i)?.[1]?.trim();
  return fountainTitle || finalDraftTitle || cleanFileTitle(screenplay.fileName);
}

function key(value: string) {
  return value.toLocaleUpperCase().replace(/\s+/g, " ").trim();
}

function idFor(prefix: string, value: string) {
  const slug = value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${prefix}-${slug || "item"}`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "untitled-story";
}

function characterName(value: string) {
  return value.replace(/^@/, "").replace(/\s*\([^)]*\)\s*\^?$/, "").replace(/\^$/, "").trim();
}

function locationName(value: string) {
  return value
    .replace(/^\.?\s*(?:INT\.?\/?EXT\.?|EXT\.?\/?INT\.?|INT\.?|EXT\.?|I\/E\.?)\s*/i, "")
    .replace(/\s+-\s+(?:DAY|NIGHT|MORNING|EVENING|LATER|CONTINUOUS|MOMENTS LATER|DAWN|DUSK|SAME)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(elements: ScreenplayElement[], maximum = 900) {
  const text = elements.map((item) => item.text).join("\n").trim();
  return text.length <= maximum ? text : `${text.slice(0, maximum).trimEnd()}…`;
}

function firstMatching(elements: ScreenplayElement[], pattern: RegExp) {
  return elements.find((item) => pattern.test(item.text))?.text ?? "";
}

function uniqueMatches(value: string, pattern: RegExp) {
  return [...new Set((value.match(pattern) ?? []).map((item) => item.toLowerCase()))].join(", ");
}

function dialogueSamples(elements: ScreenplayElement[]) {
  const samples = new Map<string, string[]>();
  let speaker = "";
  for (const element of elements) {
    if (element.type === "character") speaker = key(characterName(element.text));
    else if (element.type === "dialogue" && speaker) {
      const current = samples.get(speaker) ?? [];
      if (current.length < 4) current.push(element.text);
      samples.set(speaker, current);
    } else if (!["parenthetical", "dialogue"].includes(element.type)) speaker = "";
  }
  return samples;
}

function characterEvidence(elements: ScreenplayElement[], name: string, blockNumber?: number) {
  let speaker = "";
  const matches: string[] = [];
  for (const element of elements) {
    if (blockNumber && element.blockNumber !== blockNumber) continue;
    if (element.type === "character") speaker = key(characterName(element.text));
    else if (element.type === "dialogue" && speaker === key(name)) matches.push(element.text);
    else if (!["parenthetical", "dialogue"].includes(element.type)) speaker = "";
  }
  return matches.slice(0, 2).join(" / ");
}

function makeCharacters(elements: ScreenplayElement[]): Character[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const element of elements.filter((item) => item.type === "character")) {
    const name = characterName(element.text);
    const normalized = key(name);
    if (!normalized) continue;
    const current = counts.get(normalized);
    counts.set(normalized, { name, count: (current?.count ?? 0) + 1 });
  }
  const samples = dialogueSamples(elements);
  return [...counts.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 60)
    .map(([normalized, item], index) => {
      const sample = samples.get(normalized)?.join(" / ") ?? "";
      const character: Character = {
        id: idFor("character", item.name),
        name: item.name,
        role: index === 0 ? "Suggested protagonist" : "Supporting character",
        pronouns: "Confirm from the screenplay and writer intent.",
        description: `Appears in ${item.count} detected dialogue cue${item.count === 1 ? "" : "s"}. Review this suggested role and description.`,
        want: "Suggested question: what visible result does this character pursue?",
        need: "Suggested question: what deeper truth or change does this character resist?",
        ghost: "Suggested question: what past event still shapes this character's present strategy?",
        fatalFlaw: "Suggested question: when does this character's protective strength become costly?",
        strengths: "Review the skills, values, and behaviours repeatedly demonstrated in the screenplay.",
        arc: "Compare the character's opening and ending choices to define the arc.",
        voice: sample || "Review this character's rhythm, vocabulary, status, and subtext from the imported dialogue.",
        ...createBlankVoiceprint(),
        arcMatrix: createBlankArcMatrix(),
        image: "",
        relationships: [],
      };
      character.originEnvironment = "Infer from locations, work, family, and social evidence; confirm before treating as canon.";
      character.socialContext = "Review status, relationships, community, and access shown in the screenplay.";
      character.educationExpertise = "Review vocabulary, decisions, and demonstrated skills for evidence of expertise.";
      character.worldviewBoundaries = "Identify the belief this character protects and what they refuse to consider.";
      character.rhythmSentenceShape = sample || "Review sentence length, interruptions, pauses, and repeated structures.";
      character.vocabularyMetaphors = "Collect distinctive words, images, idioms, and comparisons from the dialogue.";
      character.verbalFingerprints = sample || "Mark repeated phrases, evasions, humour, and forms of address.";
      character.emotionalAccess = "Track what this character states directly, hides in subtext, or expresses through action.";
      character.statusShift = "Compare how the voice changes with power, fear, intimacy, and public pressure.";
      character.persuasionStrategy = "Identify whether the character argues through logic, charm, threat, guilt, humour, or silence.";
      character.arcMatrix = {
        startingState: character.description,
        consciousWant: character.want,
        underlyingNeed: character.need,
        protectiveLie: character.ghost,
        emergingTruth: character.arc,
        midpointShift: "Review the character's behaviour near Block 12 for a change in strategy or understanding.",
        crisisChoice: "Review Blocks 15–18 for the choice made when the original strategy fails.",
        climaxChoice: "Review Blocks 21–23 for the costly choice that proves change or refusal.",
        endingState: "Compare the final behaviour with the opening condition.",
        relationshipImpact: "Identify which relationship changes because of this character's final choice.",
        checkpoints: [
          { id: `${character.id}-opening`, kind: "opening", blockNumber: 1, sceneId: "", belief: character.ghost, strategy: character.want, pressure: "Opening conditions", choice: "Review the first meaningful choice.", consequence: "Review what the opening choice creates.", evidence: characterEvidence(elements, item.name, 1) || sample },
          { id: `${character.id}-midpoint`, kind: "midpoint", blockNumber: 12, sceneId: "", belief: "Review the belief under pressure.", strategy: "Review the changed tactic.", pressure: "Midpoint reframe", choice: "Identify the defining midpoint choice.", consequence: "Identify how direction or stakes change.", evidence: characterEvidence(elements, item.name, 12) },
          { id: `${character.id}-ending`, kind: "ending", blockNumber: 24, sceneId: "", belief: "Review the final lived belief.", strategy: "Review the final behaviour.", pressure: "Closing conditions", choice: "Identify the final proof of change or refusal.", consequence: "Describe the new equilibrium.", evidence: characterEvidence(elements, item.name, 24) || characterEvidence(elements, item.name) },
        ],
      };
      return character;
    });
}

function makeLocations(elements: ScreenplayElement[]): Location[] {
  const locations = new Map<string, { name: string; count: number; headings: string[] }>();
  for (const element of elements.filter((item) => item.type === "scene-heading")) {
    const name = locationName(element.text);
    const normalized = key(name);
    if (!normalized) continue;
    const current = locations.get(normalized);
    locations.set(normalized, {
      name,
      count: (current?.count ?? 0) + 1,
      headings: [...(current?.headings ?? []), element.text].slice(0, 4),
    });
  }
  return [...locations.values()].map((item) => ({
    id: idFor("location", item.name),
    name: item.name,
    description: `Detected in ${item.count} scene heading${item.count === 1 ? "" : "s"}: ${item.headings.join("; ")}. Add rules, access, sensory details, and production constraints.`,
    image: "",
  }));
}

function referencesFor(elements: ScreenplayElement[], characters: Character[], locations: Location[]) {
  const characterLookup = new Map(characters.map((item) => [key(item.name), item.id]));
  const locationLookup = new Map(locations.map((item) => [key(item.name), item.id]));
  return {
    characterIds: [...new Set(elements
      .filter((item) => item.type === "character")
      .map((item) => characterLookup.get(key(characterName(item.text))))
      .filter((item): item is string => Boolean(item)))],
    locationIds: [...new Set(elements
      .filter((item) => item.type === "scene-heading")
      .map((item) => locationLookup.get(key(locationName(item.text))))
      .filter((item): item is string => Boolean(item)))],
  };
}

function elementsForMiniBlock(elements: ScreenplayElement[], miniBlockNumber: number) {
  if (!elements.length) return [];
  const start = Math.floor(((miniBlockNumber - 1) / 4) * elements.length);
  const end = Math.max(start + 1, Math.floor((miniBlockNumber / 4) * elements.length));
  return elements.slice(start, end);
}

function populateBlock(
  block: StoryBlock,
  elements: ScreenplayElement[],
  characters: Character[],
  locations: Location[],
  protagonist: string,
) {
  const headings = elements.filter((item) => item.type === "scene-heading");
  const actions = elements.filter((item) => item.type === "action");
  const visible = actions.length ? actions : elements.filter((item) => item.type !== "section" && item.type !== "note");
  const firstBeat = visible[0]?.text ?? "";
  const lastBeat = visible.at(-1)?.text ?? "";
  const conflict = firstMatching(visible, conflictWords);
  const choice = firstMatching(elements, choiceWords);
  const headingSummary = headings.slice(0, 3).map((item) => locationName(item.text)).filter(Boolean).join(" → ");
  const refs = referencesFor(elements, characters, locations);
  const halves = [elements.slice(0, Math.ceil(elements.length / 2)), elements.slice(Math.ceil(elements.length / 2))];

  return {
    ...block,
    summary: [headingSummary, firstBeat].filter(Boolean).join(": ") || "Review the imported screenplay evidence assigned to this Block.",
    characterIds: refs.characterIds,
    locationIds: refs.locationIds,
    goal: protagonist ? `Review what ${protagonist} is trying to accomplish in this part of the script.` : "Identify the active character's immediate objective.",
    conflict: conflict || "Review the opposing pressure or obstacle visible in these scenes.",
    choice: choice || "Identify the choice that makes the next story movement necessary.",
    action: firstBeat || "Review the first visible action in this Block.",
    consequence: lastBeat || "Review the changed condition carried into the next Block.",
    emotionalTurn: firstBeat && lastBeat ? `The movement begins with “${firstBeat.slice(0, 120)}” and turns toward “${lastBeat.slice(0, 120)}”.` : "Review the emotional value at entry and exit.",
    audienceExpectation: lastBeat ? `Review what the audience is likely to expect after: “${lastBeat.slice(0, 180)}”.` : "Record the audience's strongest live expectation here.",
    pickleTurn: "Suggested question: what clue, reversal, complication, or reframe refreshes the central tension here?",
    setup: firstBeat || "Identify the promise or setup planted here.",
    payoff: lastBeat || "Identify the immediate or later payoff created here.",
    scriptExcerpt: excerpt(elements, 3500),
    storyboardDirection: actions.slice(0, 4).map((item) => item.text).join(" → ") || "Translate the most important visible change into four storyboard frames.",
    notes: `Suggested from the imported screenplay. ${elements.length} passages mapped here; confirm or revise the structural interpretation.`,
    scenes: block.scenes.map((scene, index) => {
      const sceneElements = halves[index] ?? [];
      const sceneRefs = referencesFor(sceneElements, characters, locations);
      const sceneHeading = sceneElements.find((item) => item.type === "scene-heading")?.text;
      const sceneActions = sceneElements.filter((item) => item.type === "action");
      const sceneFirst = sceneActions[0]?.text ?? sceneElements[0]?.text ?? "";
      const sceneLast = sceneActions.at(-1)?.text ?? sceneElements.at(-1)?.text ?? "";
      const estimatedSeconds = Math.max(30, Math.round((block.targetMinutes * 60) / Math.max(1, block.scenes.length)));
      return {
        ...scene,
        title: sceneHeading || `Imported movement ${index + 1}`,
        sceneType: sceneElements.some((item) => item.type === "dialogue") ? "dialogue" as const : "action" as const,
        purpose: sceneFirst || "Review the dramatic function of this imported movement.",
        entryCondition: sceneFirst || "Define the condition at scene entry.",
        exitCondition: sceneLast || "Define the changed condition at scene exit.",
        characterIds: sceneRefs.characterIds,
        locationIds: sceneRefs.locationIds,
        charactersEntering: sceneRefs.characterIds,
        charactersLeaving: [],
        objective: `Clarify the active objective in this movement for ${sceneRefs.characterIds.length ? "the participating characters" : protagonist}.`,
        opposition: firstMatching(sceneElements, conflictWords) || "Identify the active opposition.",
        conflict: firstMatching(sceneElements, conflictWords) || "Identify the pressure that prevents an easy result.",
        action: sceneFirst || "Identify the first playable action.",
        reversal: firstMatching(sceneElements, choiceWords) || "Identify the reversal, discovery, or tactic shift.",
        turn: firstMatching(sceneElements, choiceWords) || sceneLast || "Identify the decisive turn.",
        resolution: sceneLast || "Describe the immediate resolution.",
        outcome: sceneLast || "Describe what is now different.",
        estimatedSeconds,
        pageEstimate: Math.max(0.5, Math.round((estimatedSeconds / 60) * 2) / 2),
        order: scene.number,
        threadIds: ["imported-main-thread"],
        status: "draft" as const,
        locked: false,
        miniBlocks: scene.miniBlocks.map((mini) => {
          const miniElements = elementsForMiniBlock(sceneElements, mini.number);
          const miniActions = miniElements.filter((item) => item.type === "action");
          const miniDialogue = miniElements.filter((item) => item.type === "dialogue");
          const first = miniElements[0]?.text ?? "";
          const last = miniElements.at(-1)?.text ?? "";
          return {
            ...mini,
            purpose: first || `Review the imported evidence for ${mini.label}.`,
            characterId: sceneRefs.characterIds[0] ?? "",
            objective: `Identify the immediate objective in ${mini.label}.`,
            resistance: firstMatching(miniElements, conflictWords) || "Identify the pressure or contradiction.",
            action: miniActions[0]?.text ?? first,
            revelation: miniElements.find((item) => /\b(?:learns?|discovers?|realizes?|reveals?|truth|secret)\b/i.test(item.text))?.text ?? "Review what becomes newly known.",
            turn: firstMatching(miniElements, choiceWords) || last,
            visualBeat: miniActions.slice(0, 2).map((item) => item.text).join(" → ") || first,
            dialogueIntention: miniDialogue[0]?.text ? `Review the intention beneath: “${miniDialogue[0].text.slice(0, 180)}”.` : "Identify what the speaker wants from the listener.",
            entryState: first || "Define the entry state.",
            exitState: last || "Define the exit state.",
            setup: first || "Identify the setup.",
            payoff: last || "Identify the payoff.",
            notes: `Imported screenplay evidence: ${excerpt(miniElements, 500)}`,
          };
        }),
      };
    }),
  } satisfies StoryBlock;
}

function createDraftElements(elements: ScreenplayElement[], blocks: StoryBlock[], now: string): ScreenplayDraftElement[] {
  const blockCounts = new Map<number, number>();
  const blockIndexes = new Map<number, number>();
  for (const element of elements) blockCounts.set(element.blockNumber, (blockCounts.get(element.blockNumber) ?? 0) + 1);
  return elements.map((element) => {
    const index = blockIndexes.get(element.blockNumber) ?? 0;
    blockIndexes.set(element.blockNumber, index + 1);
    const total = Math.max(1, blockCounts.get(element.blockNumber) ?? 1);
    const miniBlockNumber = Math.min(4, Math.floor((index / total) * 4) + 1);
    const block = blocks[element.blockNumber - 1];
    const scene = block?.scenes.find((candidate) => candidate.miniBlocks.some((mini) => mini.number === miniBlockNumber)) ?? block?.scenes[0];
    return {
      id: element.id,
      type: element.type,
      text: element.text,
      blockNumber: element.blockNumber,
      miniBlockNumber,
      sceneNumber: Math.max(1, element.scene),
      sceneId: scene?.id ?? "",
      threadIds: ["imported-main-thread"],
      omitted: false,
      locked: false,
      revisionColour: "none",
      sourceAttributionIds: ["imported-screenplay-source"],
      aiProvenanceIds: [],
      createdAt: now,
      updatedAt: now,
    } satisfies ScreenplayDraftElement;
  });
}

function createMainThread(blocks: StoryBlock[], characters: Character[], now: string): StoryThread {
  const milestones = [1, 6, 12, 18, 24].map((blockNumber, index) => {
    const block = blocks[blockNumber - 1];
    const kinds = ["setup", "turn", "reveal", "turn", "resolution"] as const;
    return {
      id: `imported-main-milestone-${blockNumber}`,
      sceneId: block.scenes[0]?.id ?? "",
      blockNumber,
      kind: kinds[index],
      summary: block.summary || block.consequence,
      resolved: blockNumber === 24,
    };
  });
  return {
    id: "imported-main-thread",
    name: "Imported screenplay main story",
    kind: "main",
    status: "active",
    summary: "The principal causal line detected across the imported screenplay. Confirm the protagonist, objective, opposition, and final result.",
    question: blocks[0]?.audienceExpectation || "Will the protagonist achieve the central objective, and at what cost?",
    characterIds: characters.slice(0, 8).map((character) => character.id),
    sceneIds: blocks.flatMap((block) => block.scenes.map((scene) => scene.id)),
    introducedBlockNumber: 1,
    resolvedBlockNumber: 24,
    milestones,
    notes: "Created automatically during import. Split subplots and relationship lines into separate Story Threads during review.",
    createdAt: now,
    updatedAt: now,
  };
}

function createProduction(project: PlotPickleProject, now: string) {
  const textByScene = new Map<string, string>();
  project.blocks.forEach((block) => block.scenes.forEach((scene) => {
    const text = project.screenplay.draftElements.filter((element) => element.sceneId === scene.id).map((element) => element.text).join(" ");
    textByScene.set(scene.id, text);
  }));
  const breakdowns = project.blocks.flatMap((block) => block.scenes.map((scene) => {
    const text = textByScene.get(scene.id) ?? "";
    return {
      id: `imported-breakdown-${scene.id}`,
      blockNumber: block.number,
      sceneId: scene.id,
      castIds: scene.characterIds,
      locationIds: scene.locationIds,
      props: uniqueMatches(text, propWords),
      wardrobe: "Review character introductions, changes of time, and continuity for wardrobe needs.",
      vehicles: uniqueMatches(text, vehicleWords),
      effects: uniqueMatches(text, effectWords),
      stunts: uniqueMatches(text, stuntWords),
      extras: "Review scene headings and action for crowds, background performers, and stand-ins.",
      makeup: "Review injuries, age, weather, continuity, and special makeup requirements.",
      sound: "Review dialogue, atmosphere, practical sound, music, and silence requirements.",
      estimatedHours: Math.max(1, Math.ceil(scene.pageEstimate * 1.5)),
      readiness: "draft" as const,
      notes: "Auto-populated from imported screenplay evidence; production departments must confirm.",
      updatedAt: now,
    };
  }));
  const schedule = [] as PlotPickleProject["production"]["schedule"];
  for (let index = 0; index < breakdowns.length; index += 8) {
    const batch = breakdowns.slice(index, index + 8);
    schedule.push({
      id: `imported-shoot-day-${schedule.length + 1}`,
      dayNumber: schedule.length + 1,
      date: "",
      sceneIds: batch.map((item) => item.sceneId),
      locationId: batch.find((item) => item.locationIds[0])?.locationIds[0] ?? "location-tbd",
      callTime: "08:00",
      estimatedHours: Math.min(12, batch.reduce((sum, item) => sum + item.estimatedHours, 0)),
      status: "planned",
      notes: "Initial import grouping only. Rebuild around cast, location, daylight, company moves, and availability.",
      updatedAt: now,
    });
  }
  return {
    ...project.production,
    breakdowns,
    schedule,
    distribution: {
      ...project.production.distribution,
      audience: project.development.storySetup.audience,
      positioning: project.development.pitch.audiencePromise,
      releasePath: "Review the intended release path after format, budget, audience, and rights are confirmed.",
      festivalTargets: "Research current festivals that match genre, length, premiere status, and jurisdiction.",
      distributorTargets: "Identify distributors or platforms only after audience and delivery requirements are confirmed.",
      salesMaterials: "Screenplay, logline, synopsis, pitch package, rights summary, visual material, and production plan.",
      trailerPlan: "Select the clearest promise, escalation, and unanswered question without revealing the ending.",
      posterPlan: "Build from the imported screenplay's central image, protagonist, opposition, and tone.",
      socialCampaign: "Define audience, message, assets, cadence, approvals, and rights before publishing.",
      pressAngles: "Identify the human story, creative approach, themes, production context, and verified differentiators.",
      updatedAt: now,
    },
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([itemKey, item]) => `${JSON.stringify(itemKey)}:${stableStringify(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function contentHash(value: unknown) {
  const source = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createProjectFromScreenplay(screenplay: ScreenplayDocument): PlotPickleProject {
  const now = new Date().toISOString();
  const document: ScreenplayDocument = {
    ...screenplay,
    draftElements: screenplay.draftElements ?? [],
    analysisStatus: "suggested",
    analyzedAt: now,
    suggestedFields: [
      "metadata", "story", "world", "characters", "voiceprints", "arc-matrices", "ghost", "catalyst",
      "foundations", "pickle", "dialogue", "structure", "blocks", "scenes", "mini-blocks", "screenplay",
      "story-threads", "rights", "review", "pitch-package", "production-breakdowns", "shoot-schedule",
      "distribution", "collaboration",
    ],
  };
  const elements = parseScreenplay(document);
  const stats = screenplayStats(elements);
  const project = createBlankProject();
  const title = titleFromSource(document);
  const characters = makeCharacters(elements);
  const locations = makeLocations(elements);
  const protagonist = characters[0]?.name ?? "the protagonist";
  const blocks = project.blocks.map((block) => populateBlock(
    block,
    elements.filter((item) => item.blockNumber === block.number),
    characters,
    locations,
    protagonist,
  ));
  const draftElements = createDraftElements(elements, blocks, now);
  const opening = elements.filter((item) => item.blockNumber === 1 && item.type === "action");
  const catalystElements = elements.filter((item) => item.blockNumber >= 2 && item.blockNumber <= 3);
  const ending = elements.filter((item) => item.blockNumber >= 23);
  const firstLocation = locations[0]?.name ?? "the opening world";
  const laterLocation = locations.find((location) => blocks.slice(6).some((block) => block.locationIds.includes(location.id)))?.name;
  const dialogueVoices = characters.slice(0, 8).map((item) => `${item.name}: ${item.voice}`).join("\n");
  const targetMinutes = Math.max(24, stats.pages || Math.ceil(elements.length / 55));
  const language = /^Title:/im.test(document.sourceText) || /\b(?:INT|EXT)\./i.test(document.sourceText) ? "English detected; confirm language and translations." : "Confirm screenplay language and translation requirements.";

  const development = project.development;

  const imported: PlotPickleProject = {
    ...project,
    id: idFor("project", `${title}-${now}`),
    metadata: {
      ...project.metadata,
      title,
      subtitle: "Imported screenplay · complete project suggestions ready for review",
      format: document.format === "final-draft" ? "Final Draft screenplay" : document.format === "fountain" ? "Fountain screenplay" : "Plain-text screenplay",
      targetMinutes,
      genre: "Review the dominant genre and secondary genre from the imported draft.",
      tone: "Review the emotional and visual tone established by the imported draft.",
      status: "Imported · complete analysis to review",
      createdAt: now,
      updatedAt: now,
    },
    story: {
      premise: `Suggested premise: ${protagonist}'s story begins in ${firstLocation} and develops through the imported screenplay's central conflict.`,
      logline: `Suggested logline: ${protagonist} must pursue an objective through the conflict revealed in the imported screenplay.`,
      theme: `Suggested question: what idea about life is tested by ${protagonist}'s choices and consequences?`,
      antiTheme: "Suggested question: which competing belief controls the opening and opposes the emerging theme?",
      dramaticQuestion: `Will ${protagonist} achieve the central objective, and what will that pursuit require them to become?`,
      hook: excerpt(opening, 500) || "Review the opening image, disturbance, and immediate audience question.",
      catalyst: excerpt(catalystElements.filter((item) => item.type === "action"), 700) || "Identify the exact event that breaks the ordinary pattern.",
      stakes: `Suggested question: what can ${protagonist} lose personally, relationally, morally, and practically?`,
      ending: excerpt(ending, 700) || "Review the final action, consequence, new equilibrium, and closing image.",
      notes: "The complete screenplay was imported locally. Every populated interpretation is a reviewable suggestion, not confirmed canon.",
    },
    world: {
      ordinaryWorld: firstLocation ? `The opening scenes establish ${firstLocation} as the initial story world.` : "Review the ordinary world before the central disruption.",
      newWorld: laterLocation && laterLocation !== firstLocation ? `Later scenes expand or shift the story into ${laterLocation}.` : "Review where the story crosses into a changed world or condition.",
      period: "Review scene headings, props, dialogue, technology, and context to confirm period and timeline.",
      history: "Record only past events that create present rules, relationships, damage, or pressure.",
      cultures: "Review communities, institutions, rituals, status systems, language, and disagreement shown in the screenplay.",
      rules: "Identify physical, social, institutional, technological, and believed rules with visible consequences.",
      technology: "Review every tool, system, vehicle, communication method, and production-sensitive technology.",
      visualLanguage: `Build the visual language from the action, scene headings, recurring images, light, colour, scale, and movement in ${document.fileName}.`,
      locations,
    },
    development: {
      storySetup: {
        audience: "Review the intended audience, viewing context, and accessibility needs.",
        contentRating: "Review language, violence, sexuality, substances, fear, and mature themes for a target rating.",
        language,
        scope: `${stats.pages || targetMinutes} estimated pages · ${stats.scenes} detected scenes · ${characters.length} speaking characters · ${locations.length} locations.`,
        collaborators: "Confirm writer, co-writers, source authors, producers, reviewers, and other contributors.",
      },
      pitch: {
        oneSentence: `An imported screenplay following ${protagonist} from ${firstLocation} through a changing conflict.`,
        shortPitch: `Review the imported draft to define ${protagonist}'s objective, opposition, stakes, transformation, and distinctive story engine in the writer's own terms.`,
        audiencePromise: "Define the genre experience, central question, emotional journey, and reason the audience stays engaged.",
        emotionalExperience: "Track the intended movement of curiosity, tension, hope, fear, grief, humour, release, and reflection.",
        comparableTitles: "Add current comparable titles by audience, tone, scale, genre, or execution—not merely popularity.",
        visualVision: `Use the screenplay's ${locations.length} detected locations, recurring actions, and visible contrasts as the visual foundation.`,
      },
      ghost: {
        ...development.ghost,
        centralWound: `Suggested question: what happened before page one that still shapes ${protagonist}?`,
        origin: "Locate the event, relationship, loss, shame, inheritance, or false conclusion that created the wound.",
        lie: `State the protective belief ${protagonist} thinks is necessary for survival.`,
        trigger: "Identify the present events that reactivate the old strategy.",
        presentPattern: `Identify repeated behaviour in the script that reveals ${protagonist}'s protective strategy.`,
        truth: `State the truth the ending requires ${protagonist} to live through action.`,
      },
      catalyst: {
        ...development.catalyst,
        event: excerpt(catalystElements.filter((item) => item.type === "action"), 700) || "Identify the exact disruptive event.",
        timing: "Suggested from the early screenplay position; confirm the precise inciting moment and page.",
        immediateImpact: blocks[1]?.consequence || "Describe what changes before the protagonist is ready.",
        choiceForced: blocks[2]?.choice || "Identify the first choice the disruption makes unavoidable.",
        resistance: blocks[2]?.conflict || "Identify why the protagonist resists the new demand.",
        doorway: blocks[5]?.consequence || "Identify the action that makes return to the old normal impossible.",
      },
      foundations: {
        ...development.foundations,
        protagonist,
        objective: `Review ${protagonist}'s repeated actions and dialogue to state the story-level objective precisely.`,
        opposition: blocks.map((block) => block.conflict).find((value) => value && !value.startsWith("Review")) ?? "Identify the person, system, circumstance, or inner strategy that can stop the objective.",
        urgency: "Identify the clock, narrowing options, escalating cost, or irreversible consequence.",
        storyEngine: "The imported scenes have been distributed across 24 Blocks; confirm the repeatable action-pressure-consequence pattern.",
        transformation: `Compare ${protagonist}'s behaviour in Blocks 1–3 with Blocks 22–24 to define the transformation.`,
        endingProof: blocks[23]?.consequence || "Identify the final visible choice that proves change or refusal.",
      },
      pickle: {
        ...development.pickle,
        centralTension: `What will happen as ${protagonist}'s objective meets the script's central opposition?`,
        audienceQuestion: `What does the audience keep predicting, hoping, or fearing for ${protagonist}?`,
        storyPromise: "Review the repeated dramatic pattern established by the imported scenes.",
        expectedDestination: blocks[23]?.summary || "Record the outcome the audience is encouraged to anticipate.",
        unpredictableRoute: "The 24 Block suggestions identify where each complication, clue, reversal, or reframe may occur.",
        liveAnswerA: "Record one plausible answer the audience can currently believe.",
        liveAnswerB: "Record a competing plausible answer that keeps uncertainty alive.",
        escalationPattern: "Track how pressure changes through cost, knowledge, time, relationships, tactics, and moral consequence.",
        finalAnswer: blocks[23]?.consequence || "State the answer delivered by the final action and closing image.",
        signatureMove: "Identify the story-specific device, image, relationship, rule, or execution that makes the journey distinct.",
      },
      dialogue: {
        principles: "Dialogue must pursue an objective, respond to pressure, reveal relationship, and sound specific to the speaker.",
        voiceContrast: dialogueVoices || "Compare speaking characters by rhythm, vocabulary, status, humour, openness, and tactics.",
        subtext: "Track what each speaker wants, withholds, avoids, misdirects, or cannot safely say.",
        expositionRules: "Deliver necessary information through conflict, need, misunderstanding, consequence, or visible action.",
        recurringLanguage: "Collect repeated phrases, names, metaphors, jargon, promises, lies, and callbacks.",
        notes: `${characters.length} speaking characters were detected from screenplay cues. Confirm names, aliases, roles, voice rules, and dialogue ownership.`,
        worldVernacular: "Collect setting-specific language, professional terms, slang, rituals, interfaces, and naming systems.",
        monologueRules: "Use longer speeches only when tactic, status, revelation, or emotional risk keeps changing inside them.",
        subtextSeeds: "Mark lines whose literal meaning differs from the character's objective or emotional truth.",
        fieldworkNotes: "Record research, interviews, sensitivity review, pronunciation, dialect, and lived-experience verification.",
      },
      notes: {
        general: `Imported ${document.fileName} locally on ${now}. The original source text and normalized draft elements travel with this project.`,
        research: "List factual questions, experts, lived-experience checks, terminology, locations, and source permissions still required.",
        openQuestions: "Confirm protagonist, Ghost, exact Catalyst, central objective, opposition, stakes, theme, Pickle, genre, tone, audience, and final transformation.",
        continuity: `Detected ${characters.length} speaking characters and ${locations.length} locations. Review aliases, dates, knowledge, injuries, props, wardrobe, geography, and repeated locations.`,
        revisions: "All populated interpretations are suggestions from the imported script until the writer marks the analysis reviewed.",
        sources: document.fileName,
      },
    },
    screenplay: { ...document, draftElements },
    structure: {
      ...project.structure,
      sequences: project.structure.sequences.map((sequence) => {
        const sequenceBlocks = blocks.slice(sequence.blockNumbers[0] - 1, sequence.blockNumbers[1]);
        return {
          ...sequence,
          question: sequenceBlocks[0]?.goal ?? "",
          promise: sequenceBlocks[0]?.summary ?? "",
          escalation: sequenceBlocks.map((block) => block.conflict).filter(Boolean).join(" → "),
          climax: sequenceBlocks.at(-1)?.action ?? "",
          turningPoint: sequenceBlocks.at(-1)?.choice ?? "",
          result: sequenceBlocks.at(-1)?.consequence ?? "",
        };
      }),
    },
    characters,
    blocks,
    storyThreads: [],
    rights: {
      projectOwner: "Confirm project owner",
      copyrightNotice: `Copyright ${new Date().getFullYear()}. Ownership to be confirmed by the project owner.`,
      rightsStatement: `Imported locally from ${document.fileName}. Confirm authorship, source rights, collaborator agreements, and permissions before sharing or production.`,
      defaultCreativeLicence: "All rights reserved unless the confirmed owner chooses another licence",
      sourceWorkTitle: title,
      sourceWorkAuthor: "Confirm screenplay author",
      adaptationStatus: "unknown",
      collaborators: [],
      attributions: [{
        id: "imported-screenplay-source",
        title: document.fileName,
        creator: "Confirm screenplay author",
        sourceType: "other",
        sourceUrl: "",
        licence: "Confirm ownership or permission",
        permissionReference: "Local import supplied by the user",
        notes: "This record identifies the imported source file; it does not determine ownership.",
        attachedTo: ["project", "screenplay"],
        createdAt: now,
      }],
      aiProvenance: [],
    },
    revisions: [],
    review: {
      threads: [{
        id: "import-review-thread",
        title: "Confirm imported screenplay analysis",
        anchor: { kind: "project", targetId: idFor("project", `${title}-${now}`), label: "Whole imported project" },
        status: "open",
        priority: "high",
        comments: [{ id: "import-review-comment", author: "PlotPickle import", body: "Review every script-derived suggestion before treating it as canon. Start with ownership, protagonist, genre, tone, story engine, Ghost, Catalyst, stakes, ending proof, character aliases, locations, and continuity.", createdAt: now }],
        createdAt: now,
        updatedAt: now,
        resolvedAt: "",
      }],
      loglineCandidates: [{ id: "imported-logline", text: `Suggested logline: ${protagonist} must pursue an objective through the conflict revealed in the imported screenplay.`, source: "Imported screenplay analysis", selected: true, createdAt: now }],
      pitchPackage: {
        title,
        subtitle: "Imported screenplay",
        tagline: excerpt(opening, 180) || "Confirm the project's central hook.",
        logline: `Suggested logline: ${protagonist} must pursue an objective through the conflict revealed in the imported screenplay.`,
        synopsis: `Review the complete imported draft and replace this working synopsis with a causal account of ${protagonist}'s disruption, pursuit, escalation, crisis, climax, and ending.`,
        creatorStatement: "Confirm why this story matters, the writer's connection to it, and the intended creative approach.",
        audience: "Review the intended audience and viewing context.",
        comparableTitles: "Add carefully chosen comparable titles after genre, tone, audience, and scale are confirmed.",
        visualStatement: `Develop the visual statement from ${locations.length} detected locations and the screenplay's recurring images.`,
        contactLine: "Confirm project owner and contact information before external export.",
        selectedCharacterIds: characters.slice(0, 6).map((character) => character.id),
        selectedLocationIds: locations.slice(0, 6).map((location) => location.id),
        includeSections: ["cover", "logline", "synopsis", "characters", "world", "visuals", "creator", "rights"],
        updatedAt: now,
      },
    },
    production: project.production,
    collaboration: {
      ...project.collaboration,
      branch: "main",
      projectPath: `stories/${slug(title)}.ppf`,
      updatedAt: now,
    },
  };

  imported.storyThreads = [createMainThread(imported.blocks, imported.characters, now)];
  imported.screenplay = {
    ...imported.screenplay,
    draftElements: imported.screenplay.draftElements.map((element) => ({ ...element, threadIds: ["imported-main-thread"] })),
  };
  imported.blocks = imported.blocks.map((block) => ({
    ...block,
    scenes: block.scenes.map((scene) => ({ ...scene, threadIds: ["imported-main-thread"] })),
  }));
  imported.production = createProduction(imported, now);
  const revisionPayload = {
    metadata: imported.metadata,
    story: imported.story,
    world: imported.world,
    development: imported.development,
    screenplay: imported.screenplay,
    structure: imported.structure,
    characters: imported.characters,
    blocks: imported.blocks,
    storyThreads: imported.storyThreads,
    rights: imported.rights,
    review: imported.review,
    production: imported.production,
    collaboration: imported.collaboration,
  };
  imported.revisions = [{
    id: "imported-screenplay-baseline",
    label: "Imported screenplay baseline",
    notes: "Automatic baseline created before the writer confirms script-derived suggestions.",
    createdAt: now,
    schemaVersion: "1.7.0",
    contentHash: contentHash(revisionPayload),
    payload: revisionPayload,
  }];
  return imported;
}

export function markScreenplayAnalysisReviewed(project: PlotPickleProject): PlotPickleProject {
  return {
    ...project,
    metadata: { ...project.metadata, status: "Draft imported · complete analysis reviewed", updatedAt: new Date().toISOString() },
    screenplay: { ...project.screenplay, analysisStatus: "reviewed", suggestedFields: [] },
    review: {
      ...project.review,
      threads: project.review.threads.map((thread) => thread.id === "import-review-thread"
        ? { ...thread, status: "resolved", resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : thread),
    },
  };
}
