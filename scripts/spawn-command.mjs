import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import process from "node:process";
import { windowsBatchInvocation } from "./windows-batch-command.mjs";

function windowsPackageManagerInvocation(command, args) {
  const commandName = basename(String(command)).toLowerCase();
  if (commandName !== "npm.cmd" && commandName !== "npx.cmd") return null;

  const cliName = commandName === "npm.cmd" ? "npm-cli.js" : "npx-cli.js";
  const roots = [];
  if (/[\\/]/u.test(String(command))) roots.push(dirname(String(command)));
  roots.push(dirname(process.execPath));

  for (const root of roots) {
    const cli = join(root, "node_modules", "npm", "bin", cliName);
    if (existsSync(cli)) {
      return Object.freeze({ executable: process.execPath, args: Object.freeze([cli, ...args]) });
    }
  }
  return null;
}

/**
 * Spawn a command without Node's `shell: true` string concatenation.
 *
 * npm.cmd and npx.cmd are executed through their installed JavaScript entry
 * points when available, which keeps spaced --prefix paths completely outside
 * cmd.exe. Other Windows .cmd/.bat wrappers use the reviewed batch boundary,
 * where dynamic values are validated and kept out of shell command text.
 * Native executables such as node.exe and powershell.exe are spawned directly.
 */
export function spawnCommand(command, args = [], options = {}) {
  const spawnOptions = { ...options, shell: false };

  if (process.platform === "win32") {
    const packageManager = windowsPackageManagerInvocation(command, args);
    if (packageManager) {
      return spawn(packageManager.executable, packageManager.args, spawnOptions);
    }

    if (/\.(?:cmd|bat)$/i.test(command)) {
      const invocation = windowsBatchInvocation(command, args, spawnOptions.env || process.env);
      return spawn(
        invocation.executable,
        invocation.args,
        { ...spawnOptions, env: invocation.env },
      );
    }
  }

  return spawn(command, args, spawnOptions);
}
