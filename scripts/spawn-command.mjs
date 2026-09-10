import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";

export function windowsJavaScriptCliInvocation(command, args, options = {}) {
  const fileExists = options.existsSync || existsSync;
  const nodeExecutable = options.nodeExecutable || process.execPath;
  const commandName = basename(String(command)).toLowerCase();
  const commandText = String(command);

  if (commandName === "npm.cmd" || commandName === "npx.cmd") {
    const cliName = commandName === "npm.cmd" ? "npm-cli.js" : "npx-cli.js";
    const roots = [];
    if (/[\\/]/u.test(commandText)) roots.push(dirname(commandText));
    roots.push(dirname(nodeExecutable));

    for (const root of roots) {
      const cli = join(root, "node_modules", "npm", "bin", cliName);
      if (fileExists(cli)) {
        return Object.freeze({ executable: nodeExecutable, args: Object.freeze([cli, ...args]) });
      }
    }
  }

  if (commandName === "vinext.cmd" && /[\\/]/u.test(commandText)) {
    const cli = resolve(dirname(commandText), "..", "vinext", "dist", "cli.js");
    if (fileExists(cli)) return Object.freeze({ executable: nodeExecutable, args: Object.freeze([cli, ...args]) });
  }

  return null;
}

/**
 * Spawn a command without Node's `shell: true` string concatenation.
 *
 * Approved JavaScript-backed Windows wrappers are resolved to their installed
 * entry points and executed directly by Node. Unknown .cmd/.bat wrappers fail
 * closed instead of becoming dynamic cmd.exe source. Native executables such as
 * node.exe and powershell.exe are spawned directly.
 */
export function spawnCommand(command, args = [], options = {}) {
  const spawnOptions = { ...options, shell: false };

  if (process.platform === "win32") {
    const javaScriptCli = windowsJavaScriptCliInvocation(command, args);
    if (javaScriptCli) {
      return spawn(javaScriptCli.executable, javaScriptCli.args, spawnOptions);
    }

    if (/\.(?:cmd|bat)$/i.test(command)) {
      throw new Error(`Unsupported Windows batch wrapper: ${basename(String(command))}. Use an approved JavaScript CLI entry point or a native executable.`);
    }
  }

  return spawn(command, args, spawnOptions);
}
