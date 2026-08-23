import type { LearningModule } from "./learning-library";

export const earlyVisualDevelopmentLesson: LearningModule = {
  id: "early-visual-development",
  number: 92,
  path: "Craft",
  title: "From Concept Card to Storyboard Frame",
  duration: "20–30 min",
  overview: "Use legacy concept art as historical evidence and visual vocabulary without confusing it with approved Block covers, mini-block keyframes, shot plans or production assets.",
  objectives: ["Distinguish concept cards from storyboard evidence.", "Compare legacy and current visuals without overwriting either.", "Record mapping and rights decisions explicitly."],
  sections: [
    { heading: "Four different visual jobs", paragraphs: ["A concept card explores atmosphere, character relationship, world texture or a sequence promise. A Block cover summarizes a larger story movement. A mini-block storyboard frame depicts one decisive visual beat. A production keyframe or shot plan adds precise continuity, staging and camera requirements.", "One legacy image may inform multiple related Blocks, but it should not be duplicated into four mini-block slots or treated as four independent frames."], points: ["Legacy visual: source history", "Block cover: sequence summary", "Storyboard frame: exact story beat", "Production keyframe: approved continuity and execution"] },
    { heading: "Compare before approving", paragraphs: ["Place the legacy source beside current project artwork. Compare story meaning, character identity, period, costume, location, palette, composition and continuity. Preserve both when the comparison is useful.", "A source image becomes a current Block cover or pitch asset only after a writer decision. Record the source filename, SHA, mapping status, writer note and intended scope."] },
    { heading: "History, naming and rights", paragraphs: ["Legacy terminology may differ from the current screenplay. Preserve the original title in provenance and explain current-name reconciliation in captions rather than editing history out of the source image.", "Software, screenplay, educational material and image permissions are separate. Historical AI generation should be recorded when known, but unknown provider or prompt details must not be invented."] },
  ],
  definitions: [
    { term: "Legacy visual", meaning: "An earlier project image retained as source history, reference or comparison evidence." },
    { term: "Mapping status", meaning: "Confirmed, proposed, unmapped, placeholder or retired relationship between a source image and current project use." },
    { term: "Block cover", meaning: "One approved image representing a larger Block or sequence, not four mini-block frames." },
  ],
  example: { title: "Puppets across two Blocks", text: "The legacy Puppets image can remain a shared sequence reference for Blocks 1 and 2. It does not pretend that two separate approved storyboard frames already exist." },
  checklist: ["Original source metadata preserved.", "Legacy and current assets are labelled separately.", "Placeholder art is not shown as completed coverage.", "Approval scope is explicit.", "Pitch export remains writer-controlled."],
  mistakes: ["Importing by old table position alone.", "Overwriting newer approved frames.", "Treating Banner as unique art for Blocks 17–24.", "Inventing historical AI provenance."],
  exercise: "Open Afterglow’s Legacy Visuals. Compare one mapped Block image with the current screenplay and storyboard, then prepare either a pin, Block-cover approval, pitch-reference or retirement decision with a writer note.",
  apply: "Storyboard",
  tags: ["Afterglow", "legacy visuals", "concept card", "Block cover", "storyboard frame", "visual provenance", "Summer Isobel", "Banner placeholder"],
};

export function earlyVisualDevelopmentSearchText() {
  return "Afterglow Images legacy visual concept card storyboard frame block cover production keyframe visual history source SHA Summer Isobel Banner placeholder pitch package";
}
