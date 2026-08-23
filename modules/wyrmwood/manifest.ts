import type { ModuleManifest } from "../../core/contracts/module";

export const wyrmwoodManifest = {
  id: "wyrmwood",
  version: 1,
  route: "/?workspace=wyrmwood",
  capabilities: ["curriculum.read", "wyrmwood.play", "wyrmwood.progress"],
  owns: ["wyrmwood"],
  dependencies: ["learn"],
} as const satisfies ModuleManifest;
