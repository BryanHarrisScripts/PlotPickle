export type FoundationModuleId = "learn" | "creative-room";

export type ModuleCapability =
  | "curriculum.read"
  | "lesson.open"
  | "lesson.complete"
  | "creative-room.read"
  | "creative-room.reply";

export type ProjectArea = "learning" | "creativeRoom";

export interface ModuleManifest {
  readonly id: FoundationModuleId;
  readonly version: 1;
  readonly route: string;
  readonly capabilities: readonly ModuleCapability[];
  readonly owns: readonly ProjectArea[];
  readonly dependencies: readonly FoundationModuleId[];
}
