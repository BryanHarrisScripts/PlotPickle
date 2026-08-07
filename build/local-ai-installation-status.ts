import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export type LocalAiInstallation = {
  installed: boolean;
  location: string;
  detection: "running" | "path" | "registry" | "missing";
};

export type LocalAiInstallations = {
  checkedAt: string;
  ollama: LocalAiInstallation;
  comfyui: LocalAiInstallation;
};

const CACHE_MS = 30_000;
let cached: { expiresAt: number; value: LocalAiInstallations } | null = null;

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

async function existingFile(candidates: Array<string | undefined>) {
  for (const candidate of unique(candidates)) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return "";
}

function run(command: string, args: string[], timeoutMs = 2_000) {
  return new Promise<{ code: number; stdout: string }>((resolve) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: 1, stdout: "" });
    }, timeoutMs);
    child.once("error", () => {
      clearTimeout(timer);
      resolve({ code: 1, stdout: "" });
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout: Buffer.concat(chunks).toString("utf8").trim() });
    });
  });
}

async function commandLocation(commandName: string) {
  const command = process.platform === "win32" ? "where.exe" : "which";
  const result = await run(command, [commandName]);
  return result.code === 0 ? result.stdout.split(/\r?\n/, 1)[0]?.trim() || "" : "";
}

async function windowsRegistryApplication(displayPattern: string) {
  if (process.platform !== "win32") return "";
  const escapedPattern = displayPattern.replaceAll("'", "''");
  const script = [
    "$roots=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')",
    `foreach($root in $roots){foreach($item in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)){if([string]$item.DisplayName -match '${escapedPattern}'){if($item.InstallLocation){Write-Output ([string]$item.InstallLocation)}else{Write-Output ([string]$item.DisplayName)};exit 0}}}`,
    "exit 1",
  ].join(";");
  const result = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], 3_000);
  return result.code === 0 ? result.stdout.split(/\r?\n/, 1)[0]?.trim() || "" : "";
}

async function ollamaInstallation(running: boolean): Promise<LocalAiInstallation> {
  if (running) return { installed: true, location: "Local Ollama service", detection: "running" };
  const location = await existingFile([
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe") : undefined,
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, "Ollama", "ollama.exe") : undefined,
    await commandLocation(process.platform === "win32" ? "ollama.exe" : "ollama"),
  ]);
  return location
    ? { installed: true, location, detection: "path" }
    : { installed: false, location: "", detection: "missing" };
}

async function comfyInstallation(running: boolean): Promise<LocalAiInstallation> {
  if (running) return { installed: true, location: "Local ComfyUI service", detection: "running" };
  const location = await existingFile([
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "ComfyUI", "ComfyUI.exe") : undefined,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "ComfyUI Desktop", "ComfyUI.exe") : undefined,
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, "ComfyUI", "ComfyUI.exe") : undefined,
    await commandLocation(process.platform === "win32" ? "ComfyUI.exe" : "comfyui"),
  ]);
  if (location) return { installed: true, location, detection: "path" };
  const registry = await windowsRegistryApplication("^(ComfyUI|Comfy Desktop)");
  return registry
    ? { installed: true, location: registry, detection: "registry" }
    : { installed: false, location: "", detection: "missing" };
}

export async function detectLocalAiInstallations(input: { ollamaRunning: boolean; comfyuiRunning: boolean }): Promise<LocalAiInstallations> {
  if (cached && cached.expiresAt > Date.now()) {
    const value = cached.value;
    return {
      ...value,
      ollama: input.ollamaRunning ? { installed: true, location: "Local Ollama service", detection: "running" } : value.ollama,
      comfyui: input.comfyuiRunning ? { installed: true, location: "Local ComfyUI service", detection: "running" } : value.comfyui,
    };
  }
  const [ollama, comfyui] = await Promise.all([
    ollamaInstallation(input.ollamaRunning),
    comfyInstallation(input.comfyuiRunning),
  ]);
  const value = { checkedAt: new Date().toISOString(), ollama, comfyui };
  cached = { expiresAt: Date.now() + CACHE_MS, value };
  return value;
}
