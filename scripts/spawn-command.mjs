import { spawn } from "node:child_process";
import process from "node:process";

function windowsBatchArguments(command, args) {
  const values = [command, ...args].map((value) => {
    const text = String(value);
    if (/[\r\n\0"&|<>^%!]/u.test(text)) {
      throw new Error(`Windows batch argument contains unsupported command-shell characters: ${text}`);
    }
    return text;
  });
  return ["/d", "/c", ...values];
}

/**
 * Spawn a command without Node's `shell: true` string concatenation.
 *
 * Windows cannot execute .cmd or .bat files directly through CreateProcess,
 * so those wrappers are passed to cmd.exe using separate child-process
 * arguments. Values that could alter cmd.exe parsing are rejected before the
 * process starts. Native executables such as node.exe and powershell.exe are
 * spawned directly, preserving paths such as C:\Program Files\nodejs\node.exe.
 */
export function spawnCommand(command, args = [], options = {}) {
  const spawnOptions = { ...options, shell: false };

  if (process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command)) {
    return spawn(
      process.env.ComSpec || "cmd.exe",
      windowsBatchArguments(command, args),
      spawnOptions,
    );
  }

  return spawn(command, args, spawnOptions);
}
