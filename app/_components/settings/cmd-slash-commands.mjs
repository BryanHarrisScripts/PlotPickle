// Discoverable, source-reviewed operational Command templates. Selection only
// fills the composer; existing dispatchers remain the sole execution authority.
export const CMD_SLASH_COMMANDS = Object.freeze([
  { category: "Discovery", command: "PlotPickle tools", description: "List the existing creative and development tools" },
  { category: "Discovery", command: "PlotPickle status", description: "Inspect the selected PPF without changing it" },
  { category: "Library", command: "PlotPickle library", description: "List saved projects in the unlocked Library" },
  { category: "Library", command: "PlotPickle open <saved story title>", description: "Select a uniquely identified saved Library project; replace placeholder" },
  { category: "Story", command: "PlotPickle plan Block 01", description: "Inspect source-backed Plan state for Block 01" },
  { category: "Story", command: "PlotPickle workflow Block 01", description: "Inspect production workflow state for Block 01" },
  { category: "Story", command: "PlotPickle assessment Block 01", description: "Inspect the current Block assessment" },
  { category: "Story", command: "PlotPickle diagnose Block 01", description: "Read Block diagnostics without starting inference" },
  { category: "Story", command: "PlotPickle mind-map fields foundations", description: "List canonical Mind Map foundation fields" },
  { category: "Story", command: "PlotPickle world-map fields", description: "List World Map fields" },
  { category: "Agents", command: "PlotPickle agents inventory", description: "Inspect registered agents" },
  { category: "Agents", command: "PlotPickle agents status", description: "Inspect agent connection state" },
  { category: "Connections", command: "PlotPickle connections status", description: "Read provider readiness without changing routes" },
  { category: "Connections", command: "PlotPickle connect local", description: "Open existing Local connection settings (no provider switch)" },
  { category: "Connections", command: "PlotPickle connect hybrid", description: "Open existing Hybrid connection settings (no provider switch)" },
  { category: "OpenPencil", command: "OpenPencil help", description: "List supported OpenPencil operations" },
  { category: "OpenPencil", command: "OpenPencil status", description: "Read the local OpenPencil connection status" },
  { category: "OpenPencil", command: "OpenPencil open ASSETS", description: "Open the registered ASSETS design in the desktop editor" },
  { category: "OpenPencil", command: "OpenPencil review ASSETS", description: "Prepare read-only ASSETS design review evidence" },
  { category: "OpenPencil", command: "OpenPencil open Timeline", description: "Open the registered Timeline design" },
  { category: "OpenPencil", command: "OpenPencil open Storyboard", description: "Open the registered Storyboard design" },
].map((entry) => Object.freeze(entry)));

/** Slash is discovery only; it never submits or authorizes a tool call. */
export function findCmdSlashSuggestions(value, limit = 40) {
  const input = typeof value === "string" ? value.trimStart() : "";
  if (!input.startsWith("/") || input.includes("\n")) return [];
  const query = input.slice(1).trim().toLocaleLowerCase("en-US");
  const tokens = query.split(/\s+/u).filter(Boolean);
  return CMD_SLASH_COMMANDS.filter(({ command, category, description }) => {
    const searchable = `${command} ${category} ${description}`.toLocaleLowerCase("en-US");
    return tokens.every((word) => searchable.includes(word));
  }).slice(0, Math.max(0, Math.min(40, Number(limit) || 0)));
}
