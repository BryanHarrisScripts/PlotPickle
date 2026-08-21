const FINAL_DRAFT_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&apos;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
};

function entityAt(value: string, index: number) {
  const end = value.indexOf(";", index + 1);
  if (end < 0 || end - index > 10) return null;
  const entity = value.slice(index, end + 1);
  const named = FINAL_DRAFT_ENTITIES[entity.toLowerCase()];
  if (named !== undefined) return { text: named, end };
  const decimal = entity.match(/^&#([0-9]{1,7});$/);
  if (!decimal) return null;
  const codePoint = Number(decimal[1]);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return null;
  return { text: String.fromCodePoint(codePoint), end };
}

/** Read Final Draft paragraph text once without recursively reinterpreting encoded markup. */
export function finalDraftPlainText(value: string) {
  let output = "";
  let index = 0;
  while (index < value.length) {
    if (value[index] === "<") {
      const end = value.indexOf(">", index + 1);
      if (end >= 0) {
        const tag = value.slice(index + 1, end).trim().toLowerCase();
        if (tag === "br" || tag === "br/") output += "\n";
        index = end + 1;
        continue;
      }
    }
    if (value[index] === "&") {
      const decoded = entityAt(value, index);
      if (decoded) {
        output += decoded.text;
        index = decoded.end + 1;
        continue;
      }
    }
    output += value[index];
    index += 1;
  }
  return output.trim();
}
