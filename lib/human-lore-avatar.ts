export const HUMAN_LORE_AVATAR_CONTRACT = [
  "PLOTPICKLE LORE AVATAR CONTRACT.",
  "Create one painterly fantasy character portrait suitable for a circular profile crop.",
  "Preserve the Human's requested appearance and personality cues without turning the image into a brand logo.",
  "Use a dark enchanted-storybook atmosphere with tactile natural materials, restrained teal and warm ember accents, readable face lighting, and a calm cinematic composition.",
  "Head-and-shoulders or upper-torso framing, centered subject, simple atmospheric background, no extra people.",
  "No text, lettering, watermark, logo, UI frame, badge, photoreal celebrity imitation, grotesque distortion, duplicate face, or extra limbs.",
].join(" ");

const GENERATED_AVATAR = /^\/api\/local-ai\/assets\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp)$/i;

export function isPlotPickleGeneratedAvatarRef(value: string) {
  return GENERATED_AVATAR.test(value.trim());
}

export function buildHumanLoreAvatarPrompt(description: string) {
  const humanDescription = description.replace(/\s+/g, " ").trim().slice(0, 1_000);
  if (!humanDescription) throw new Error("Describe the Human you want the Lore Avatar to represent.");
  return `${HUMAN_LORE_AVATAR_CONTRACT} HUMAN DESCRIPTION: ${humanDescription}`;
}
