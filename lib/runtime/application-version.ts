import packageManifest from "../../package.json";
import { compareSemanticVersions } from "./application-version-core.mjs";

export const PLOTPICKLE_VERSION = packageManifest.version;

export function applicationVersionAtLeast(minimumVersion: string, currentVersion = PLOTPICKLE_VERSION) {
  return compareSemanticVersions(currentVersion, minimumVersion) >= 0;
}

export { compareSemanticVersions };
