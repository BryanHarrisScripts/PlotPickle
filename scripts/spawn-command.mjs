import { spawn } from "node:child_process";
import process from "node:process";

function quoteForCommandPrompt(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

/**
 * Spawn a command without Node's `shell: true` string concatenation.
 *
 * Windows cannot execute .cmd or .bat files directly through CreateProcess,
 * so those wrappers are passed to cmd.exe as one explicitly quoted command.
 * Native executables such as node.exe and powershell.exe are always spawned
 * directly, preserving paths such as C:\Program Files\nodejs\node.exe.
 */
export function spawnCommand(command, args = [], options = {}) {
  const spawnOptions = { ...options, shell: false };

  if (process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command)) {
    const commandLine = [command, ...args].map(quoteForCommandPrompt).join(" ");
    return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", commandLine], spawnOptions);
  }

  return spawn(command, args, spawnOptions);
}
