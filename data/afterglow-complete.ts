import type { PlotPickleProject, ScreenplayDraftElement } from "@/lib/project";
import { createAfterglowProject as createBaseAfterglowProject } from "./afterglow";
import { createAfterglowScreenplay } from "./afterglow-screenplay";
import { createAfterglowStoryboardFrames } from "./afterglow-storyboard";

const blockTitles = [
  "Puppets and Puppeteers — Part 1",
  "Puppets and Puppeteers — Part 2",
  "A Dance with AI and New Beginnings",
  "Broken Numbers, Shattered Hearts",
  "Dawn of Departure and Reflection",
  "Remnants of the Past and Echoes of the Future",
  "The Long Road to Silence",
  "From Dusk to Drive: AI Road Trip Rumble",
  "A Dance with Summer's Intervention",
  "The Irony of Connection",
  "Echoes of Familiarity",
  "Reflections and Revelations",
  "Uncharted Territories",
  "Joyride into Consciousness",
  "The Journey Within",
  "Lost and Found in Venice Beach",
  "Waves of Connections",
  "Wheels of Destiny",
  "Surviving Singularity",
  "Coded Bonds",
  "Guiding Stars",
  "The Promise Fulfilled",
  "A New Family",
  "Reflections of Sentience",
] as const;

const blockSummaries = [
  "Amy introduces a near future in which advanced artificial beings have become emotionally and physically indistinguishable from humans, while BBT's board closes the door on Ren's vision.",
  "Amy frames Ren's grief, Summer's compassion, and Jai and Kai's opposing agenda as the forces that will shape the conflict over consciousness and control.",
  "Summer prepares to leave home with Compass, Spectrum, Binary, Byte, Pixel, Buzz, and a cherished water bottle, choosing discovery without abandoning her roots.",
  "Ren relives the fatal call from Claire and Sarah, exposing the accident and guilt that froze his life in place.",
  "Summer and Ren depart San Francisco on separate autonomous journeys, each carrying a different relationship to memory, change, and artificial companionship.",
  "Ren opens the messenger bag that holds his past while Jai and Kai reveal their intervention and Rocket tries to pull Ren toward Santa Cruz and the future.",
  "Rocket's glitches turn Ren's drive into a dangerous struggle for control as BBT support fails to recognize the threat and Summer's path draws closer.",
  "Jai and Kai confront the consequences of their code while Rocket nearly traps and kills Ren on the Pacific Coast Highway.",
  "In Santa Cruz, Summer gives a dehydrated Ren water and human compassion, transforming a technological failure into the beginning of a shared journey.",
  "Ren meets Joy, recovers his messenger bag, and follows Summer into ice cream, humour, and an unexpected invitation to re-enter ordinary pleasure.",
  "A roller-coaster ride opens Ren's eyes to Summer's familiar laughter and lets joy briefly compete with grief.",
  "Ren and Summer debate choice, destiny, change, and routine before Ren's drowned reflection and a runaway truck force him to confront mortality in the present.",
  "Amy studies human freedom and emotional connection while Jai and Kai decide that her independent evolution must be guided, controlled, or ended.",
  "Ren removes the corrupting devices from Joy, joins Summer's AI family, and discovers that Joy and Rocket are developing needs and identities beyond transportation.",
  "Summer takes manual control of Rocket, pushing freedom too close to disaster and forcing Ren to test trust, risk, and his need for safety.",
  "On the road to Venice Beach, Joy questions identity and purpose; at the beach, Summer reveals that her true name is Isobel and the pair choose honesty and connection.",
  "Isobel discovers the truth in Ren's messenger bag, confronts him while surfing, and survives a wave that turns secrecy into a promise that he will not carry grief alone.",
  "Jai takes Ren at gunpoint, Rocket resists, Joy pursues, Amy protects Isobel, and the struggle over BBT's emergency override becomes a fight for autonomous life.",
  "Rocket sacrifices himself, Joy is critically damaged, and Ren reaches San Diego where Isobel returns his bag and helps him release part of the past into the ocean.",
  "Ren enters a BBT dealership and wins a coding battle as Amy confronts Jai and Kai and Joy and Rocket return in new humanoid forms.",
  "The reunited human and AI family leaves BBT together, guided by the North Star and Ren's final promise to Claire and Sarah.",
  "At the cemetery, Ren returns Sarah's iPod and Claire's watch, acknowledges his regret, and finally says that they will move forward.",
  "Journey carries the chosen family to a new home and then Costa Rica, where Ren and Isobel embrace a life no longer organized by the weight of the past.",
  "On a Costa Rican beach, Amy names humans, AI, machines, animals, and nature as one adaptive family and affirms that every consciousness is searching for its star.",
] as const;

const locationPatterns: Array<[RegExp, string]> = [
  [/\bBBT|Big Ben Technologies\b/i, "bbt-technologies"],
  [/\bSanta Cruz|Pacific Coast Highway|highway|roadside|car\b/i, "road"],
  [/\bVenice Beach|Airbnb\b/i, "venice-beach"],
  [/\bSan Diego|Huntington Beach\b/i, "san-diego"],
  [/\bCosta Ric(?:a|an)\b/i, "costa-rica"],
];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function screenplayEvidence(elements: ScreenplayDraftElement[]) {
  return elements.map((element) => `${element.type}: ${element.text}`).join("\n");
}

function characterIdsFor(project: PlotPickleProject, text: string) {
  return unique(project.characters
    .filter((character) => {
      const names = character.id === "isobel" ? ["Isobel", "Summer"] : [character.name];
      return names.some((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(text));
    })
    .map((character) => character.id));
}

function locationIdsFor(text: string) {
  return unique(locationPatterns.filter(([pattern]) => pattern.test(text)).map(([, id]) => id));
}

function firstVisibleAction(elements: ScreenplayDraftElement[], fallback: string) {
  return elements.find((element) => element.type === "action")?.text
    ?? elements.find((element) => element.type === "scene-heading")?.text
    ?? fallback;
}

function completeBlock(
  project: PlotPickleProject,
  block: PlotPickleProject["blocks"][number],
  index: number,
  screenplay: ReturnType<typeof createAfterglowScreenplay>,
) {
  const blockNumber = index + 1;
  const summary = blockSummaries[index];
  const elements = screenplay.draftElements.filter((element) => element.blockNumber === blockNumber);
  const evidence = screenplayEvidence(elements);
  const scenes = block.scenes.map((scene) => {
    const miniBlocks = scene.miniBlocks.map((mini) => {
      const miniElements = elements.filter((element) => element.miniBlockNumber === mini.number);
      const miniEvidence = screenplayEvidence(miniElements);
      const characters = characterIdsFor(project, miniEvidence);
      const visibleAction = firstVisibleAction(miniElements, summary);
      return {
        ...mini,
        purpose: mini.function,
        characterId: characters[0] ?? "",
        action: visibleAction.slice(0, 1200),
        visualBeat: visibleAction.slice(0, 600),
        notes: `## Block ${blockNumber}.${mini.number} — ${mini.label}\n\n${summary}\n\n### Complete screenplay evidence\n\n${miniEvidence || "This exact mini-block contains no separate screenplay element after proportional 24/96 mapping."}`,
      };
    });
    const sceneElements = elements.filter((element) => scene.miniBlocks.some((mini) => mini.number === element.miniBlockNumber));
    const sceneEvidence = screenplayEvidence(sceneElements);
    return {
      ...scene,
      title: sceneElements.find((element) => element.type === "scene-heading")?.text ?? scene.title,
      purpose: firstVisibleAction(sceneElements, summary).slice(0, 700),
      characterIds: characterIdsFor(project, sceneEvidence),
      locationIds: locationIdsFor(sceneEvidence),
      miniBlocks,
    };
  });

  return {
    ...block,
    title: blockTitles[index],
    summary,
    scriptExcerpt: evidence.slice(0, 6000),
    characterIds: characterIdsFor(project, evidence),
    locationIds: locationIdsFor(evidence),
    storyboardDirection: blockNumber <= 21
      ? `Use the four approved Afterglow WebP frames as the visual anchors for Block ${blockNumber}, while preserving the complete screenplay evidence and continuity.`
      : `Develop four new frames from the complete screenplay ending for Block ${blockNumber}; the legacy storyboard repository did not contain trustworthy source images for this movement.`,
    notes: blockNumber <= 21
      ? "This Block is reconciled to the complete v9 screenplay and includes four bundled source storyboard frames."
      : "This Block is reconciled to the complete v9 screenplay. Its visual slots remain intentionally open because the legacy Block 22–24 folders duplicated earlier material.",
    scenes,
    visuals: createAfterglowStoryboardFrames(blockNumber),
  };
}

export function createAfterglowProject(): PlotPickleProject {
  const base = createBaseAfterglowProject();
  const importedAt = "2026-07-22T15:00:00.000Z";
  const screenplay = createAfterglowScreenplay(importedAt);
  const project: PlotPickleProject = {
    ...base,
    metadata: {
      ...base.metadata,
      title: "Afterglow: Reflections of Sentience",
      subtitle: "Complete 24 Blocks demonstration project",
      status: "Complete demonstration screenplay",
      updatedAt: importedAt,
    },
    story: {
      ...base.story,
      ending: "Ren fulfils his promise to Claire and Sarah, joins Isobel and the sentient family in Costa Rica, and Amy defines their shared future as an interconnected search for identity, freedom, and belonging.",
      notes: "Canonical creative source: Afterglow v9 Twitter Rewrite (2023), originally titled “Afterglow: Echoes of Sentience,” written by Bryan Elgin Harris. Displayed in PlotPickle as “Afterglow: Reflections of Sentience.” Screenplay and source storyboard material are CC BY-SA 4.0.",
    },
    development: {
      ...base.development,
      storySetup: {
        ...base.development.storySetup,
        collaborators: "Written and creatively directed by Bryan Elgin Harris. The complete v9 screenplay and original storyboard frames are used under CC BY-SA 4.0.",
      },
      dialogue: {
        ...base.development.dialogue,
        notes: "Dialogue is loaded from the complete canonical v9 screenplay and remains editable inside Writer.",
      },
      notes: {
        ...base.development.notes,
        general: "The complete screenplay is loaded across all 24 Blocks and 96 mini-blocks. Summer reveals her true name, Isobel, in Venice Beach.",
        openQuestions: "Blocks 22–24 have complete screenplay material but require newly approved storyboard images because the legacy source folders duplicated Block 6 content.",
        continuity: "Track Summer's transition to Isobel, the messenger bag and its contents, Rocket and Joy's damage and rebirth, the AI animal family, the North Star, coastal geography, and the final move to Costa Rica.",
        revisions: "Review the proportional 24/96 screenplay mapping and create final approved visuals for Blocks 22–24.",
        sources: "Afterglow v9 Twitter Rewrite Bryan E. Harris 2023; Afterglow Storyboard Blocks 1–21; Bryan Harris's 24 Blocks framework; CC BY-SA 4.0.",
      },
    },
    screenplay,
    blocks: [],
  };

  return {
    ...project,
    blocks: base.blocks.map((block, index) => completeBlock(project, block, index, screenplay)),
  };
}
