import type { ModuleManifest } from "../../core/contracts/module";

export const creativeRoomManifest = {
  id: "creative-room",
  version: 1,
  route: "/",
  capabilities: ["creative-room.read", "creative-room.reply"],
  owns: ["creativeRoom"],
  dependencies: [],
} as const satisfies ModuleManifest;
