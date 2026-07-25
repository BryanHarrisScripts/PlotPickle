import type { LearningModule } from "./learning-library";

export const moodColourVisualLanguage: LearningModule = {
  id: "mood-colour-visual-language",
  number: 70,
  path: "Craft",
  title: "Mood, Colour and Visual Language",
  duration: "30–45 min",
  overview: "Use mood boards as a vocabulary for emotional atmosphere, world texture, lighting, composition and change—not as instructions to copy a finished film or creator.",
  objectives: ["Separate mood from tone and palette from a final colour grade.", "Read hue, value, saturation, contrast, lighting, texture, shape and lens feel as story information.", "Select visual ingredients deliberately and route them through the Visual Bible approval boundary."],
  sections: [
    { heading: "Mood, tone and visual ingredients", paragraphs: ["Mood is the audience's immediate emotional atmosphere. Tone is the storyteller's attitude toward the material. A palette is a starting set of colour relationships; it is not a scientific or finished production colour grade.", "Hue, value, saturation and contrast work in context. Warm and cool relationships, cultural colour associations and lighting choices are not universal emotional codes. Describe the actual audience effect you intend."], points: ["Hue and temperature", "Value and contrast", "Saturation", "Lighting direction and source", "Texture and material", "Shape and composition", "Camera distance and lens feel"] },
    { heading: "Repetition with variation", paragraphs: ["A visual system becomes meaningful through repetition, change and consequence. Track how a colour, shape, material, distance or lighting rule appears at setup, changes under pressure and returns at payoff or reflection.", "Opening and closing images may mirror, invert or complicate one another. A reference should help articulate that relationship rather than force every scene into one look."] },
    { heading: "Reference, project asset and generated asset", paragraphs: ["A bundled PlotPickle board is an inspiration reference, not a project-owned production image. Pinning or selecting it does not copy its pixels into the project or change canonical visual language.", "New AI-generated assets require separate provider, model, prompt and writer-decision provenance. Character identity locks, location continuity and rights choices still apply."] },
  ],
  definitions: [
    { term: "Mood", meaning: "The emotional atmosphere experienced by the audience." },
    { term: "Tone", meaning: "The storyteller's attitude toward the subject and audience." },
    { term: "Visual language", meaning: "A repeatable set of colour, light, texture, composition, camera and continuity choices." },
    { term: "Reference board", meaning: "A source of visual vocabulary that remains separate from canonical project assets." },
  ],
  example: { title: "Three references, one original system", text: "Choose one board for emotional atmosphere, one for world texture and one for lighting. Extract three colours and one composition rule, then rewrite them in project-specific language instead of naming the boards in a prompt." },
  checklist: ["Choose one emotional-atmosphere reference.", "Choose one world-texture reference.", "Choose one lighting or camera reference.", "Select three colours to test.", "Name one visual element that changes over the story.", "Record what should not be copied."],
  mistakes: ["Treating colour associations as universal.", "Using a named film or creator as the complete style instruction.", "Applying a board automatically to every character, location or scene.", "Confusing bundled references with owned production assets."],
  exercise: "Open the Visual Reference Library. Select three references for different jobs, choose three palette values and one changing visual element, then open an editable Visual Bible proposal.",
  apply: "Treatment",
  tags: ["MoodBoard", "mood board", "colour palette", "color palette", "visual language", "lighting", "texture", "lens feel", "opening image", "closing image", "visual continuity", "Reference Library"],
};
