export const BUZZ_IDENTITY_ONBOARDING_URL = "https://github.com/block/buzz/releases/latest";

export const PLOTPICKLE_BUZZ_COMMUNITY = Object.freeze({
  name: "PlotPickle Community BBS",
  displayName: "PlotPickle Playhouse",
  relayUrl: "wss://plotpickleplayhouse.communities.buzz.xyz",
  directoryUrl: "https://buzz.directory/communities/plotpickle-community-bbs-ad08e6622fce447297d2f893774d654d",
  greatHallName: "great-hall",
  requiredConnection: true,
  removableByHuman: false,
});

export const PLOTPICKLE_FEDERATION_POLICY = Object.freeze({
  rootCommunity: PLOTPICKLE_BUZZ_COMMUNITY,
  allowHumanOwnedCommunities: true,
  memberRequirement: "plotpickle-human-with-connected-buzz",
  socialAuthority: "buzz",
});

export const DEFAULT_HUMAN_LORE_GLYPH = "ᛉ";

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
