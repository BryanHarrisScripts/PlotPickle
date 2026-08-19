const ACCESSIBLE_CONTROL_PATTERN = /(?:^|\n)\s*-\s*(button|link|tab|textbox|searchbox|combobox|checkbox|radio)\s+(?:"([^"]*)")?[^\n]*?\[ref=([^\]]+)\]/gi;

export function writerVisibleControls(snapshot, pattern = ACCESSIBLE_CONTROL_PATTERN) {
  const controls = [];
  pattern.lastIndex = 0;
  let match = pattern.exec(String(snapshot));
  while (match) {
    const label = String(match[2] || "").trim();
    if (label) controls.push({ role: match[1].toLowerCase(), label, ref: match[3] });
    match = pattern.exec(String(snapshot));
  }
  return controls;
}
