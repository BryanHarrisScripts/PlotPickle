import {
  createBlankProject,
  createBlankVoiceprint,
  type Character,
  type Location,
  type PlotPickleProject,
  type ScreenplayDocument,
  type StoryBlock,
} from "./project";
import { parseScreenplay, type ScreenplayElement } from "./screenplay";

const conflictWords = /\b(?:against|attacks?|blocks?|but|cannot|conflict|danger|fails?|fight|forced|however|refuses?|struggle|threat|trapped)\b/i;
const choiceWords = /\b(?:chooses?|decides?|must|refuses?|risks?|swears?|will|won't)\b/i;

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

function dialogueSamples(elements: ScreenplayElement[]) {
  const samples = new Map<string, string[]>();
  let speaker = "";
  for (const element of elements) {
    if (element.type === "character") speaker = key(characterName(element.text));
    else if (element.type === "dialogue" && speaker) {
      const current = samples.get(speaker) ?? [];
      if (current.length < 3) current.push(element.text);
      samples.set(speaker, current);
    } else if (!["parenthetical", "dialogue"].includes(element.type)) speaker = "";
  }
  return samples;
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
    .slice(0, 40)
    .map(([normalized, item], index) => ({
      id: idFor("character", item.name),
      name: item.name,
      role: index === 0 ? "Suggested protagonist" : "Supporting character",
      pronouns: "",
      description: `Appears in ${item.count} detected dialogue cue${item.count === 1 ? "" : "s"}. Review this suggested role and description.`,
      want: "",
      need: "",
      ghost: "",
      fatalFlaw: "",
      strengths: "",
      arc: "",
      voice: samples.get(normalized)?.join(" / ") ?? "",
      ...createBlankVoiceprint(),
      image: "",
      relationships: [],
    }));
}

function makeLocations(elements: ScreenplayElement[]): Location[] {
  const locations = new Map<string, { name: string; count: number }>();
  for (const element of elements.filter((item) => item.type === "scene-heading")) {
    const name = locationName(element.text);
    const normalized = key(name);
    if (!normalized) continue;
    const current = locations.get(normalized);
    locations.set(normalized, { name, count: (current?.count ?? 0) + 1 });
  }
  return [...locations.values()].map((item) => ({
    id: idFor("location", item.name),
    name: item.name,
    description: `Detected in ${item.count} scene heading${item.count === 1 ? "" : "s"}. Add the story rules and visual details that matter here.`,
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
  const castNames = refs.characterIds.map((id) => characters.find((item) => item.id === id)?.name).filter(Boolean).join(", ");
  const halves = [elements.slice(0, Math.ceil(elements.length / 2)), elements.slice(Math.ceil(elements.length / 2))];

  return {
    ...block,
    summary: [headingSummary, firstBeat].filter(Boolean).join(": "),
    characterIds: refs.characterIds,
    locationIds: refs.locationIds,
    goal: protagonist ? `Review what ${protagonist} is trying to accomplish in this part of the script.` : "Identify the active character's immediate objective.",
    conflict: conflict || "Review the opposing pressure or obstacle visible in these scenes.",
    choice: choice || "Identify the choice that makes the next story movement necessary.",
    action: firstBeat,
    consequence: lastBeat,
    emotionalTurn: firstBeat && lastBeat ? `The movement begins with “${firstBeat.slice(0, 120)}” and turns toward “${lastBeat.slice(0, 120)}”.` : "",
    audienceExpectation: lastBeat ? `Review what the audience is likely to expect after: “${lastBeat.slice(0, 180)}”.` : "",
    pickleTurn: "Suggested question: what clue, reversal, complication, or reframe refreshes the central tension here?",
    setup: firstBeat,
    payoff: lastBeat,
    scriptExcerpt: excerpt(elements, 3500),
    storyboardDirection: actions.slice(0, 4).map((item) => item.text).join(" → "),
    notes: `Suggested from the imported screenplay. ${elements.length} passages mapped here; confirm or revise the structural interpretation.`,
    scenes: block.scenes.map((scene, index) => {
      const sceneElements = halves[index];
      const sceneRefs = referencesFor(sceneElements, characters, locations);
      const sceneHeading = sceneElements.find((item) => item.type === "scene-heading")?.text;
      const sceneActions = sceneElements.filter((item) => item.type === "action");
      const sceneFirst = sceneActions[0]?.text ?? sceneElements[0]?.text ?? "";
      const sceneLast = sceneActions.at(-1)?.text ?? sceneElements.at(-1)?.text ?? "";
      return {
        ...scene,
        title: sceneHeading || `Imported movement ${index + 1}`,
        purpose: sceneFirst,
        characterIds: sceneRefs.characterIds,
        locationIds: sceneRefs.locationIds,
        objective: castNames ? `Clarify what ${castNames} pursue in this movement.` : "",
        conflict: firstMatching(sceneElements, conflictWords),
        turn: firstMatching(sceneElements, choiceWords) || sceneLast,
        resolution: sceneLast,
        outcome: sceneLast,
      };
    }),
  } satisfies StoryBlock;
}

export function createProjectFromScreenplay(screenplay: ScreenplayDocument): PlotPickleProject {
  const now = new Date().toISOString();
  const document: ScreenplayDocument = {
    ...screenplay,
    analysisStatus: "suggested",
    analyzedAt: now,
    suggestedFields: ["project", "story", "world", "characters", "ghost", "catalyst", "foundations", "pickle", "dialogue", "structure", "blocks", "visual-board"],
  };
  const elements = parseScreenplay(document);
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
  const opening = elements.filter((item) => item.blockNumber === 1 && item.type === "action");
  const catalystElements = elements.filter((item) => item.blockNumber >= 2 && item.blockNumber <= 3);
  const ending = elements.filter((item) => item.blockNumber >= 23);
  const firstLocation = locations[0]?.name ?? "the opening world";
  const laterLocation = locations.find((location) => blocks.slice(6).some((block) => block.locationIds.includes(location.id)))?.name;
  const dialogueVoices = characters.slice(0, 6).filter((item) => item.voice).map((item) => `${item.name}: ${item.voice}`).join("\n");

  return {
    ...project,
    id: idFor("project", `${title}-${now}`),
    metadata: {
      ...project.metadata,
      title,
      subtitle: "Imported screenplay · structural suggestions ready for review",
      targetMinutes: Math.max(24, Math.ceil(Math.max(1, ...elements.map((item) => item.page)))),
      status: "Imported · suggestions to review",
      createdAt: now,
      updatedAt: now,
    },
    story: {
      ...project.story,
      premise: `Suggested premise: ${protagonist}'s story begins in ${firstLocation}. Clarify the central pressure and transformation.`,
      logline: `Suggested logline: ${protagonist} must pursue an objective through the conflict revealed in the imported screenplay.`,
      dramaticQuestion: `Will ${protagonist} achieve the central objective, and what will that pursuit require them to become?`,
      hook: excerpt(opening, 500),
      catalyst: excerpt(catalystElements.filter((item) => item.type === "action"), 700),
      ending: excerpt(ending, 700),
      notes: "The complete screenplay was imported locally. Structural answers are suggestions until reviewed by the writer.",
    },
    world: {
      ...project.world,
      ordinaryWorld: firstLocation ? `The opening scenes establish ${firstLocation} as the initial story world.` : "",
      newWorld: laterLocation && laterLocation !== firstLocation ? `Later scenes expand or shift the story into ${laterLocation}.` : "Review where the story crosses into a changed world.",
      visualLanguage: `Build the visual language from the action and scene headings in ${document.fileName}.`,
      locations,
    },
    development: {
      ...project.development,
      pitch: {
        ...project.development.pitch,
        oneSentence: `An imported screenplay following ${protagonist} from ${firstLocation} through a changing conflict.`,
        shortPitch: `Review the imported draft to define ${protagonist}'s objective, opposition, stakes, and transformation in the writer's own terms.`,
        visualVision: `Use the screenplay's ${locations.length} detected locations and visible action as the visual foundation.`,
      },
      ghost: {
        ...project.development.ghost,
        centralWound: `Suggested question: what happened before page one that still shapes ${protagonist}?`,
        presentPattern: `Suggested question: which repeated behaviour in the script reveals ${protagonist}'s protective strategy?`,
        truth: `Suggested question: what truth does the ending require ${protagonist} to live through action?`,
      },
      catalyst: {
        ...project.development.catalyst,
        event: excerpt(catalystElements.filter((item) => item.type === "action"), 700),
        timing: "Suggested from the early screenplay position; confirm the precise inciting moment.",
        immediateImpact: blocks[1]?.consequence ?? "",
        choiceForced: blocks[2]?.choice ?? "",
        resistance: blocks[2]?.conflict ?? "",
        doorway: blocks[5]?.consequence ?? "",
      },
      foundations: {
        ...project.development.foundations,
        protagonist,
        objective: `Review ${protagonist}'s repeated actions and dialogue to state the story-level objective precisely.`,
        opposition: blocks.map((block) => block.conflict).find((value) => value && !value.startsWith("Review")) ?? "",
        storyEngine: "The imported scenes have been distributed across 24 Blocks; confirm the causal action-consequence chain.",
        transformation: `Compare ${protagonist}'s behaviour in Blocks 1–3 with Blocks 22–24 to define the transformation.`,
        endingProof: blocks[23]?.consequence ?? "",
      },
      pickle: {
        ...project.development.pickle,
        centralTension: `What will happen as ${protagonist}'s objective meets the script's central opposition?`,
        audienceQuestion: `What does the audience keep predicting, hoping, or fearing for ${protagonist}?`,
        storyPromise: "Review the repeated dramatic pattern established by the imported scenes.",
        expectedDestination: blocks[23]?.summary ?? "",
        unpredictableRoute: "The 24 Block suggestions identify where each complication or reframe may occur.",
        finalAnswer: blocks[23]?.consequence ?? "",
      },
      dialogue: {
        ...project.development.dialogue,
        voiceContrast: dialogueVoices,
        notes: `${characters.length} speaking characters were detected from screenplay cues. Confirm names, roles, voice rules, and aliases.`,
      },
      notes: {
        ...project.development.notes,
        openQuestions: "Confirm the protagonist, Ghost, exact Catalyst, central objective, opposition, stakes, theme, Pickle, and final transformation.",
        continuity: `Detected ${characters.length} speaking characters and ${locations.length} locations. Review aliases and repeated locations before generating visual references.`,
        revisions: "All populated interpretations are suggestions from the imported script until the writer marks the analysis reviewed.",
        sources: document.fileName,
      },
    },
    screenplay: document,
    characters,
    blocks,
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
  };
}

export function markScreenplayAnalysisReviewed(project: PlotPickleProject): PlotPickleProject {
  return {
    ...project,
    metadata: { ...project.metadata, status: "Draft imported · structure reviewed" },
    screenplay: { ...project.screenplay, analysisStatus: "reviewed", suggestedFields: [] },
  };
}
