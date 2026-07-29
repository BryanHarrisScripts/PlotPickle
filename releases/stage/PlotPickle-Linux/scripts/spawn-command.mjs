import { spawn } from "node:child_process";
import process from "node:process";

/**
 * Spawn a command without Node's `shell: true` string concatenation.
 *
 * Windows cannot execute .cmd or .bat files directly through CreateProcess,
 * so those wrappers are passed to cmd.exe using separate child-process
 * arguments. Node then quotes only values that require quoting, including
 * script paths and arguments containing spaces. Native executables such as
 * node.exe and powershell.exe are spawned directly, preserving paths such as
 * C:\Program Files\nodejs\node.exe.
 */
export function spawnCommand(command, args = [], options = {}) {
  const spawnOptions = { ...options, shell: false };

  if (process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command)) {
    return spawn(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/c", command, ...args],
      spawnOptions,
    );
  }

  return spawn(command, args, spawnOptions);
}
