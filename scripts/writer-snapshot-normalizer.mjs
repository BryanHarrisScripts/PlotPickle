function replaceAccessibleName(line, label) {
  return String(line).replace(/(\bbutton\s+")[^"]*(")/i, `$1${label}$2`);
}

function normalizeDisclosureLine(line, label) {
  if (!String(line).toLowerCase().includes(label.toLowerCase())) return line;
  const ref = String(line).match(/\[ref=([^\]]+)\]/i)?.[1];
  if (!ref) return line;
  return `  - button "${label}" [ref=${ref}]`;
}

function normalizeLearnTopicLine(line) {
  const text = String(line || "");
  if (!/\bbutton\s+"/i.test(text) || !/\[(?:expanded|collapsed)\]/i.test(text)) return text;
  for (const label of ["Foundations", "World"]) {
    const quoted = text.match(/\bbutton\s+"([^"]*)"/i)?.[1] || "";
    if (new RegExp(`^${label}(?:\\b|\\s|·)`, "i").test(quoted)) return replaceAccessibleName(text, label);
  }
  return text;
}

export function normalizeWriterSnapshot(text) {
  const disclosureLabels = [
    "Advanced Setup",
    "Advanced runtime details",
    "Cloud and legacy provider overrides",
  ];
  return String(text || "").split(/\r?\n/).map((rawLine) => {
    let line = normalizeLearnTopicLine(rawLine);
    for (const label of disclosureLabels) {
      if (line.toLowerCase().includes(label.toLowerCase()) && /\[ref=[^\]]+\]/i.test(line)) {
        line = normalizeDisclosureLine(line, label);
        break;
      }
    }
    return line;
  }).join("\n");
}
