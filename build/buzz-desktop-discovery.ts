import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const BUZZ_DESKTOP_COMPATIBILITY = {
  releaseTag: "desktop-v0.5.3",
  version: "0.5.3",
  sourceCommit: "3a96ace",
  windowsAsset: "Buzz_0.5.3_x64-setup_alpha-unsigned.exe",
} as const;

export type BuzzCliSource = "configured" | "environment" | "buzz-desktop" | "path";

export type BuzzCliResolution = {
  executable: string;
  source: BuzzCliSource;
  discovered: boolean;
  releaseTag: string;
};

type BuzzCliDiscoveryOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
  canAccess?: (candidate: string) => Promise<boolean>;
};

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

export function buzzDesktopCliCandidates(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home = os.homedir(),
) {
  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA;
    const programFiles = env.ProgramFiles;
    const programFilesX86 = env["ProgramFiles(x86)"];
    const roots = unique([
      localAppData ? path.join(localAppData, "Buzz") : undefined,
      localAppData ? path.join(localAppData, "Programs", "Buzz") : undefined,
      programFiles ? path.join(programFiles, "Buzz") : undefined,
      programFilesX86 ? path.join(programFilesX86, "Buzz") : undefined,
    ]);
    return unique(roots.flatMap((root) => [
      path.join(root, "buzz.exe"),
      path.join(root, "resources", "buzz.exe"),
      path.join(root, "buzz-x86_64-pc-windows-msvc.exe"),
      path.join(root, "resources", "buzz-x86_64-pc-windows-msvc.exe"),
    ]));
  }

  if (platform === "darwin") {
    return unique([
      "/Applications/Buzz.app/Contents/MacOS/buzz",
      "/Applications/Buzz.app/Contents/Resources/buzz",
      path.join(home, "Applications", "Buzz.app", "Contents", "MacOS", "buzz"),
      path.join(home, "Applications", "Buzz.app", "Contents", "Resources", "buzz"),
    ]);
  }

  return unique([
    path.join(home, ".local", "bin", "buzz"),
    "/usr/local/bin/buzz",
    "/usr/bin/buzz",
    "/opt/Buzz/buzz",
    "/opt/Buzz/resources/buzz",
    "/usr/lib/buzz/buzz",
  ]);
}

async function defaultCanAccess(candidate: string) {
  try {
    await access(candidate, process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveBuzzCliExecutable(
  explicitPath = "",
  options: BuzzCliDiscoveryOptions = {},
): Promise<BuzzCliResolution> {
  const configured = explicitPath.trim();
  if (configured) {
    return { executable: configured, source: "configured", discovered: false, releaseTag: "" };
  }

  const env = options.env ?? process.env;
  const environmentPath = env.BUZZ_CLI_PATH?.trim();
  if (environmentPath) {
    return { executable: environmentPath, source: "environment", discovered: false, releaseTag: "" };
  }

  const canAccess = options.canAccess ?? defaultCanAccess;
  const candidates = buzzDesktopCliCandidates(
    options.platform ?? process.platform,
    env,
    options.home ?? os.homedir(),
  );
  for (const candidate of candidates) {
    if (await canAccess(candidate)) {
      return {
        executable: candidate,
        source: "buzz-desktop",
        discovered: true,
        releaseTag: BUZZ_DESKTOP_COMPATIBILITY.releaseTag,
      };
    }
  }

  return {
    executable: (options.platform ?? process.platform) === "win32" ? "buzz.exe" : "buzz",
    source: "path",
    discovered: false,
    releaseTag: "",
  };
}
