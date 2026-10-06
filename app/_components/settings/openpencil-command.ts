export type OpenPencilCommand =
  | Readonly<{ action: "help" }>
  | Readonly<{ action: "status" }>
  | Readonly<{ action: "disconnect" }>
  | Readonly<{ action: "connect"; workspaceRoot: string }>
  | Readonly<{ action: "open"; surfaceName: string }>
  | Readonly<{ action: "review"; surfaceName: string }>;

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
  if (new RegExp(`^/?${noun}\\s+disconnectexport type OpenPencilCommand =
  | Readonly<{ action: "help" }>
  | Readonly<{ action: "status" }>
  | Readonly<{ action: "disconnect" }>
  | Readonly<{ action: "connect"; workspaceRoot: string }>
  | Readonly<{ action: "open"; surfaceName: string }>
  | Readonly<{ action: "review"; surfaceName: string }>;

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
, "iu").test(input) || new RegExp(`^disconnect\\s+${noun}export type OpenPencilCommand =
  | Readonly<{ action: "help" }>
  | Readonly<{ action: "status" }>
  | Readonly<{ action: "disconnect" }>
  | Readonly<{ action: "connect"; workspaceRoot: string }>
  | Readonly<{ action: "open"; surfaceName: string }>
  | Readonly<{ action: "review"; surfaceName: string }>;

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
, "iu").test(input)) {
    return Object.freeze({ action: "disconnect" });
  }

  const open = input.match(new RegExp(`^/?${noun}\\s+open\\s+(.+)export type OpenPencilCommand =
  | Readonly<{ action: "help" }>
  | Readonly<{ action: "status" }>
  | Readonly<{ action: "disconnect" }>
  | Readonly<{ action: "connect"; workspaceRoot: string }>
  | Readonly<{ action: "open"; surfaceName: string }>
  | Readonly<{ action: "review"; surfaceName: string }>;

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
, "iu"));
  const surfaceName = cleanRoot(open?.[1] || "");
  if (surfaceName) return Object.freeze({ action: "open", surfaceName });

  const review = input.match(new RegExp(`^(?:/?${noun}\\s+review|review\\s+(?:open\\s*[- ]?\\s*pencil\\s+)?design\\s+changes)\\s+(.+)export type OpenPencilCommand =
  | Readonly<{ action: "help" }>
  | Readonly<{ action: "status" }>
  | Readonly<{ action: "disconnect" }>
  | Readonly<{ action: "connect"; workspaceRoot: string }>
  | Readonly<{ action: "open"; surfaceName: string }>
  | Readonly<{ action: "review"; surfaceName: string }>;

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
, "iu"));
  const reviewSurface = cleanRoot(review?.[1] || "");
  if (reviewSurface) return Object.freeze({ action: "review", surfaceName: reviewSurface });

  const direct = input.match(new RegExp(`^/?${noun}\\s+connect\\s+(.+)export type OpenPencilCommand =
  | Readonly<{ action: "help" }>
  | Readonly<{ action: "status" }>
  | Readonly<{ action: "disconnect" }>
  | Readonly<{ action: "connect"; workspaceRoot: string }>
  | Readonly<{ action: "open"; surfaceName: string }>
  | Readonly<{ action: "review"; surfaceName: string }>;

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
, "iu"));
  const natural = input.match(new RegExp(`^connect\\s+${noun}\\s+(.+)$`, "iu"));
  const workspaceRoot = cleanRoot((direct?.[1] || natural?.[1] || "").trim());
  if (workspaceRoot) return Object.freeze({ action: "connect", workspaceRoot });
  return null;
}

export const OPENPENCIL_COMMAND_HELP = [
  "OpenPencil open <surface name>",
  "OpenPencil review <surface name>",
  "OpenPencil status",
  "OpenPencil connect <absolute local design workspace>",
  "OpenPencil disconnect",
].join("\n");
