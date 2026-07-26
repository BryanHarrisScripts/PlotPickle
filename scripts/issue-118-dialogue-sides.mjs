import { readFileSync, writeFileSync } from "node:fs";

const path = "lib/consolidated-reports.ts";
let source = readFileSync(path, "utf8");
const needle = `    voiceConsistency: project.characters.map((character) => ({\n      id: character.id,\n      name: character.name,\n      hasVoiceProfile: filled([character.voice, character.rhythmSentenceShape, character.vocabularyMetaphors, character.verbalFingerprints, character.persuasionStrategy]) >= 2,\n      spokenWords: report.characters.find((candidate) => candidate.id === character.id)?.wordCount ?? 0,\n      target: target("plan", character.id, { characterId: character.id }),\n    })),\n  };`;
const replacement = `    voiceConsistency: project.characters.map((character) => ({\n      id: character.id,\n      name: character.name,\n      hasVoiceProfile: filled([character.voice, character.rhythmSentenceShape, character.vocabularyMetaphors, character.verbalFingerprints, character.persuasionStrategy]) >= 2,\n      spokenWords: report.characters.find((candidate) => candidate.id === character.id)?.wordCount ?? 0,\n      target: target("plan", character.id, { characterId: character.id }),\n    })),\n    sides: report.characters.map((character) => ({\n      id: character.id,\n      name: character.name,\n      sceneHeadings: character.sceneHeadings,\n      dialogueEntries: character.dialogueEntries,\n      words: character.wordCount,\n      estimatedSpeakingSeconds: character.estimatedSpeakingSeconds,\n      target: target("write", character.id, { characterId: character.id }),\n    })),\n  };`;
if (!source.includes(needle)) throw new Error("Dialogue report insertion anchor was not found.");
source = source.replace(needle, replacement);
writeFileSync(path, source, "utf8");
console.log("Added explicit character sides to the Dialogue report.");
