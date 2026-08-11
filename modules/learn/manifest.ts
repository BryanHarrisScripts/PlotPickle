import type { ModuleManifest } from "../../core/contracts/module";

export const learnManifest = {
  id: "learn",
  version: 1,
  route: "/",
  capabilities: ["curriculum.read", "lesson.open", "lesson.complete"],
  owns: ["learning"],
  dependencies: [],
} as const satisfies ModuleManifest;
