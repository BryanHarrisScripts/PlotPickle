import type { PlotPickleProject, ScreenplayDraftElementType } from "./project";
import { parseScreenplay } from "./screenplay";

export type CharacterDialogueReport = {
  id: string;
  name: string;
  role: string;
  description: string;
  dialogueLines: number;
  wordCount: number;
  sceneNumbers: number[];
  sceneHeadings: Array<{ number: number; heading: string }>;
  firstScene: number | null;
  lastScene: number | null;
  estimatedSpeakingSeconds: number;
};

export type ScreenplayReportSummary = {
  charactersWithDialogue: number;
  dialogueLines: number;
  spokenWords: number;
  scenes: number;
  estimatedSpeakingSeconds: number;
};

type ReportElement = {
  type: ScreenplayDraftElementType | "section" | "note";
  text: string;
  scene: number;
};

const technicalExtensions = /\s*\((?:V\.?O\.?|O\.?S\.?|O\.?C\.?|CONT['’]?D|CONTINUED|PRE-?LAP|FILTERED|ON (?:THE )?PHONE|INTO (?:THE )?PHONE)\)\s*$/i;

export function normalizeCharacterCue(value: string) {
  let normalized = value.replace(/^@/, "").replace(/\^$/, "").trim();
  while (technicalExtensions.test(normalized)) normalized = normalized.replace(technicalExtensions, "").trim();
  return normalized.replace(/\s+/g, " ").toUpperCase();
}

export function countSpokenWords(value: string) {
  return value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function dialogueLineCount(value: string) {
  return Math.max(1, value.split(/\r?\n/).filter((line) => line.trim()).length);
}

function reportElements(project: PlotPickleProject): ReportElement[] {
  if (project.screenplay.draftElements.length) {
    return project.screenplay.draftElements.map((element) => ({
      type: element.type,
      text: element.text,
      scene: Math.max(1, element.sceneNumber),
    }));
  }
  return parseScreenplay(project.screenplay).map((element) => ({
    type: element.type,
    text: element.text,
    scene: Math.max(1, element.scene),
  }));
}

export function createCharacterDialogueReport(project: PlotPickleProject) {
  const elements = reportElements(project);
  const reports = new Map<string, CharacterDialogueReport>();
  const headings = new Map<number, string>();

  project.characters.forEach((character) => {
    const key = normalizeCharacterCue(character.name);
    if (!key) return;
    reports.set(key, {
      id: character.id,
      name: character.name,
      role: character.role,
      description: character.description,
      dialogueLines: 0,
      wordCount: 0,
      sceneNumbers: [],
      sceneHeadings: [],
      firstScene: null,
      lastScene: null,
      estimatedSpeakingSeconds: 0,
    });
  });

  elements.forEach((element) => {
    if (element.type === "scene-heading") headings.set(element.scene, element.text);
  });

  let currentCharacter = "";
  elements.forEach((element) => {
    if (element.type === "character") {
      currentCharacter = normalizeCharacterCue(element.text);
      return;
    }
    if (element.type === "parenthetical") return;
    if (element.type !== "dialogue") {
      currentCharacter = "";
      return;
    }
    if (!currentCharacter || !element.text.trim()) return;

    const existing = reports.get(currentCharacter) ?? {
      id: `script-character-${currentCharacter.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: currentCharacter,
      role: "Detected in screenplay",
      description: "",
      dialogueLines: 0,
      wordCount: 0,
      sceneNumbers: [],
      sceneHeadings: [],
      firstScene: null,
      lastScene: null,
      estimatedSpeakingSeconds: 0,
    };
    existing.dialogueLines += dialogueLineCount(element.text);
    existing.wordCount += countSpokenWords(element.text);
    if (!existing.sceneNumbers.includes(element.scene)) existing.sceneNumbers.push(element.scene);
    reports.set(currentCharacter, existing);
  });

  const characterReports = [...reports.values()].map((report) => {
    const sceneNumbers = [...report.sceneNumbers].sort((a, b) => a - b);
    return {
      ...report,
      sceneNumbers,
      sceneHeadings: sceneNumbers.map((number) => ({ number, heading: headings.get(number) || "Scene heading not available" })),
      firstScene: sceneNumbers.at(0) ?? null,
      lastScene: sceneNumbers.at(-1) ?? null,
      estimatedSpeakingSeconds: Math.round((report.wordCount / 130) * 60),
    };
  });

  const summary = characterReports.reduce<ScreenplayReportSummary>((total, report) => ({
    charactersWithDialogue: total.charactersWithDialogue + (report.dialogueLines ? 1 : 0),
    dialogueLines: total.dialogueLines + report.dialogueLines,
    spokenWords: total.spokenWords + report.wordCount,
    scenes: Math.max(total.scenes, report.lastScene ?? 0),
    estimatedSpeakingSeconds: total.estimatedSpeakingSeconds + report.estimatedSpeakingSeconds,
  }), { charactersWithDialogue: 0, dialogueLines: 0, spokenWords: 0, scenes: 0, estimatedSpeakingSeconds: 0 });

  return { characters: characterReports, summary };
}
