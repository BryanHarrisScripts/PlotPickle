const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function safeCodePoint(value: number) {
  return Number.isInteger(value)
    && value >= 0
    && value <= 0x10ffff
    && !(value >= 0xd800 && value <= 0xdfff);
}

/** Decode each source entity at most once so nested text such as &amp;lt; stays &lt;. */
export function decodeHtmlEntitiesOnce(value: string) {
  return value.replace(/&(?:amp|apos|gt|lt|nbsp|quot|#39|#[0-9]{1,7});/gi, (entity) => {
    const body = entity.slice(1, -1).toLowerCase();
    if (body.startsWith("#")) {
      const codePoint = Number(body.slice(1));
      return safeCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return NAMED_ENTITIES[body] ?? entity;
  });
}

function asciiLetter(value: string | undefined) {
  if (!value) return false;
  const code = value.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function tagStart(value: string, index: number) {
  let cursor = index + 1;
  if (value[cursor] === "/") cursor += 1;
  const marker = value[cursor];
  return asciiLetter(marker) || marker === "!" || marker === "?";
}

function tagEnd(value: string, start: number) {
  let quote = "";
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return index;
  }
  return -1;
}

function tagName(value: string) {
  let index = 0;
  while (index < value.length && (value[index] === "<" || value[index] === "/" || value[index] === " " || value[index] === "\t")) index += 1;
  const start = index;
  while (index < value.length && asciiLetter(value[index])) index += 1;
  return value.slice(start, index).toLowerCase();
}

export function stripHtmlComments(value: string) {
  let output = "";
  let index = 0;
  while (index < value.length) {
    if (!value.startsWith("<!--", index)) {
      output += value[index];
      index += 1;
      continue;
    }
    const end = value.indexOf("-->", index + 4);
    if (end < 0) {
      output += value.slice(index);
      break;
    }
    index = end + 3;
  }
  return output;
}

/** Remove presentation-only markup with a scanner rather than a partial regex sanitizer. */
export function stripMarkupTags(
  value: string,
  options: { preserveBreaks?: boolean; tagSeparator?: string } = {},
) {
  const input = stripHtmlComments(value);
  let output = "";
  let index = 0;
  while (index < input.length) {
    if (input[index] !== "<" || !tagStart(input, index)) {
      output += input[index];
      index += 1;
      continue;
    }
    const end = tagEnd(input, index);
    if (end < 0) {
      output += input[index];
      index += 1;
      continue;
    }
    const name = tagName(input.slice(index, end + 1));
    if (options.preserveBreaks && name === "br") output += "\n";
    else if (options.tagSeparator) output += options.tagSeparator;
    index = end + 1;
  }
  return output;
}

/** Decode only tag delimiters once; deliberately does not decode ampersands recursively. */
export function decodeMarkupDelimitersOnce(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&LT;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&GT;", ">")
    .replaceAll("\\u003c", "<")
    .replaceAll("\\u003C", "<")
    .replaceAll("\\u003e", ">")
    .replaceAll("\\u003E", ">");
}

export function stripKnownPromptScaffolding(value: string, labels: readonly string[]) {
  const blocked = new Set(labels.map((label) => label.trim().toLowerCase()));
  const withoutTags = stripMarkupTags(decodeMarkupDelimitersOnce(value));
  return withoutTags
    .split("\n")
    .filter((line) => {
      const normalized = line.trim().replace(/:$/, "").toLowerCase();
      return !blocked.has(normalized);
    })
    .join("\n")
    .replaceAll("\r", "");
}
