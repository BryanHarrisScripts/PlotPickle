export function writerVisibleControls(snapshot) {
  const controls = [];
  const pattern = /(?:^|\n)\s*-\s*(button|link|tab|textbox|searchbox|combobox|checkbox|radio)\s+(?:"([^"]*)")?[^\n]*?\[ref=([^\]]+)\]/gi;
  let match = pattern.exec(String(snapshot));
  while (match) {
    const label = String(match[2] || "").trim();
    if (label) controls.push({ role: match[1].toLowerCase(), label, ref: match[3] });
    match = pattern.exec(String(snapshot));
  }
  return controls;
}

export function writerVisibleToolArgs(tool, values) {
  const properties = tool?.inputSchema?.properties || {};
  const output = { element: values.element || "visible control" };
  if ("ref" in properties) output.ref = values.ref;
  else if ("target" in properties) output.target = values.ref;
  if (values.text !== undefined) {
    output.text = String(values.text || "");
    if ("slowly" in properties) output.slowly = false;
    if ("submit" in properties) output.submit = false;
  }
  return output;
}
