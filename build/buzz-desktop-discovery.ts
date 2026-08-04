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

function windowsBuzzCliCandidates(root: string) {
  const join = path.win32.join;
  const targetBinary = "buzz-x86_64-pc-windows-msvc.exe";

  return [
    join(root, "binaries", targetBinary),
    join(root, "resources", "binaries", targetBinary),
    join(root, "resources", targetBinary),
    join(root, targetBinary),
    join(root, "binaries", "buzz.exe"),
    join(root, "resources", "binaries", "buzz.exe"),
    join(root, "resources", "buzz.exe"),
  ];
}

export function buzzDesktopCliCandidates(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home = os.homedir(),
) {
  if (platform === "win32") {
    const join = path.win32.join;
    const localAppData = env.LOCALAPPDATA;
    const programFiles = env.ProgramFiles;
    const programFilesX86 = env["ProgramFiles(x86)"];
    const roots = unique([
      localAppData ? join(localAppData, "Buzz") : undefined,
      localAppData ? join(localAppData, "Programs", "Buzz") : undefined,
      programFiles ? join(programFiles, "Buzz") : undefined,
      programFilesX86 ? join(programFilesX86, "Buzz") : undefined,
    ]);

    // Buzz Desktop's GUI is normally installed as Buzz.exe in the root folder.
    // Windows paths are case-insensitive, so probing root\buzz.exe can launch the
    // GUI instead of the bundled CLI. Only search sidecar-specific names and
    // directories here; a separately installed CLI remains available through PATH.
    return unique(roots.flatMap(windowsBuzzCliCandidates));
  }

  const join = path.posix.join;
  if (platform === "darwin") {
    return unique([
      "/Applications/Buzz.app/Contents/Resources/binaries/buzz",
      "/Applications/Buzz.app/Contents/Resources/buzz",
      join(home, "Applications", "Buzz.app", "Contents", "Resources", "binaries", "buzz"),
      join(home, "Applications", "Buzz.app", "Contents", "Resources", "buzz"),
    ]);
  }

  return unique([
    join(home, ".local", "bin", "buzz"),
    "/usr/local/bin/buzz",
    "/usr/bin/buzz",
    "/opt/Buzz/binaries/buzz",
    "/opt/Buzz/resources/binaries/buzz",
    "/opt/Buzz/resources/buzz",
    "/usr/lib/buzz/binaries/buzz",
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
  const platform = options.platform ?? process.platform;
  const candidates = buzzDesktopCliCandidates(platform, env, options.home ?? os.homedir());
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
    executable: platform === "win32" ? "buzz.exe" : "buzz",
    source: "path",
    discovered: false,
    releaseTag: "",
  };
}
