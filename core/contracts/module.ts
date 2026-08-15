export type FoundationModuleId = "learn" | "creative-room" | "wyrmwood";

export type ModuleCapability =
  | "curriculum.read"
  | "lesson.open"
  | "lesson.complete"
  | "creative-room.read"
  | "creative-room.reply"
  | "wyrmwood.play"
  | "wyrmwood.progress";

export type ProjectArea = "learning" | "creativeRoom" | "wyrmwood";

export interface ModuleManifest {
  readonly id: FoundationModuleId;
  readonly version: 1;
  readonly route: string;
  readonly capabilities: readonly ModuleCapability[];
  readonly owns: readonly ProjectArea[];
  readonly dependencies: readonly FoundationModuleId[];
}
