import process from "node:process";

function quoteWindowsShellArg(value) {
  const text = String(value);
  if (/[\r\n\0"]/u.test(text)) {
    throw new Error(`Windows verification argument contains unsupported characters: ${text}`);
  }
  return `"${text}"`;
}

export function windowsVerificationCommand(command, args = []) {
  return [command, ...args].map(quoteWindowsShellArg).join(" ");
}

export function verificationCommandFor(node, options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const nodeExecPath = options.nodeExecPath || process.execPath;

  if (node.tool === "node") {
    return { command: nodeExecPath, args: [...node.args] };
  }

  if (node.tool === "npm") {
    if (platform === "win32") {
      return {
        command: env.ComSpec || "cmd.exe",
        args: ["/d", "/s", "/c", windowsVerificationCommand("npm.cmd", node.args)],
      };
    }
    return { command: "npm", args: [...node.args] };
  }

  throw new Error(`Unsupported Full Verification tool: ${node.tool}`);
}
