export type CinematographyCategory =
  | "framing"
  | "camera-angle"
  | "camera-movement"
  | "lens"
  | "composition"
  | "lighting"
  | "colour-texture"
  | "edit-transition"
  | "narrative-device"
  | "vfx-physical"
  | "sound-atmosphere"
  | "continuity";

export type CinematographyApplicability = "still" | "video" | "both";

export interface CinematographyPrimitive {
  readonly id: string;
  readonly category: CinematographyCategory;
  readonly technique: string;
  readonly intents: readonly string[];
  readonly observableEffect: string;
  readonly aliases: readonly string[];
  readonly applicability: CinematographyApplicability;
  readonly compatibleWith: readonly string[];
  readonly conflictsWith: readonly string[];
}

export interface CinematographySelection {
  readonly primitiveIds: readonly string[];
  readonly matchedIntents: readonly string[];
  readonly medium: "still" | "video";
}
