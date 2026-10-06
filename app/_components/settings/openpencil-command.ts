export type OpenPencilCommand =
  | Readonly<{ action: "help" }>
  | Readonly<{ action: "status" }>
  | Readonly<{ action: "disconnect" }>
  | Readonly<{ action: "connect"; workspaceRoot: string }>;

function cleanRoot(value: string) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function parseOpenPencilCommand(value: string): OpenPencilCommand | null {
  const input = value.trim();
  if (!input) return null;
  const noun = String.raw`open\s*[- ]?\s*pencil`;

  if (new RegExp(`^/?${noun}(?:\\s+help)?$`, "iu").test(input)) return Object.freeze({ action: "help" });
  if (new RegExp(`^/?${noun}\\s+status$`, "iu").test(input)) return Object.freeze({ action: "status" });
  if (new RegExp(`^/?${noun}\\s+disconnect$`, "iu").test(input) || new RegExp(`^disconnect\\s+${noun}$`, "iu").test(input)) {
    return Object.freeze({ action: "disconnect" });
  }

  const direct = input.match(new RegExp(`^/?${noun}\\s+connect\\s+(.+)$`, "iu"));
  const natural = input.match(new RegExp(`^connect\\s+${noun}\\s+(.+)$`, "iu"));
  const workspaceRoot = cleanRoot((direct?.[1] || natural?.[1] || "").trim());
  if (workspaceRoot) return Object.freeze({ action: "connect", workspaceRoot });
  return null;
}

export const OPENPENCIL_COMMAND_HELP = [
  "OpenPencil status",
  "OpenPencil connect <absolute local design workspace>",
  "OpenPencil disconnect",
].join("\n");
