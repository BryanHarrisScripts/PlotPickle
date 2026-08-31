import path from "node:path";
import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import { persistentHome } from "../../local-credentials";

export function autonomousGuestWorkspaceStorageDirectory(authority: AutonomousGuestAuthority) {
  if (
    authority.authorityClass !== "delegated-guest-autonomous-operator" ||
    authority.delegated !== true ||
    authority.humanProfileId !== "" ||
    !/^guest-auto-[a-f0-9]{24}$/i.test(authority.workspaceId)
  ) {
    throw new Error("Autonomous Guest storage requires delegated non-Human authority and a valid Guest workspace.");
  }
  return path.join(persistentHome(), "autonomous-guest", authority.workspaceId);
}
