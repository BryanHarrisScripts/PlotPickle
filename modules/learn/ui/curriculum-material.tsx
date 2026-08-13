import type { ReactNode } from "react";
import type { CurriculumSource } from "../../../core/contracts/curriculum";
import type { LocalCurriculumSourceTarget } from "../model/local-curriculum-links";

type CurriculumMaterialProps = {
  readonly onOpenLesson: (lessonId: string) => void;
  readonly resolveLocalReference: (href: string) => LocalCurriculumSourceTarget | undefined;
  readonly source: CurriculumSource;
};

type InlineRenderContext = Pick<CurriculumMaterialProps, "onOpenLesson" | "resolveLocalReference">;

type SourceBlock =
  | { readonly kind: "code"; readonly language: string; readonly text: string }
  | { readonly kind: "heading"; readonly level: number; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[]; readonly ordered: boolean; readonly start?: number }
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "quote"; readonly lines: readonly string[] }
  | { readonly kind: "rule" }
  | { readonly kind: "table"; readonly headings: readonly string[]; readonly rows: readonly (readonly string[])[] };

function decodeEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

/**
 * The archived lessons contain a mixture of Markdown and presentation-only HTML.
 * Convert the HTML wrappers to readable Markdown without ever changing the raw
 * source kept in the exact-text disclosure below.
 */
function readableMarkdown(content: string) {
  return decodeEntities(content)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi, (_match, attributes: string, body: string) => {
      let number = Number(attributes.match(/\bstart=["']?(\d+)/i)?.[1] ?? "1");
      return body.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_item, text: string) => `${number++}. ${text.trim()}\n`);
    })
    .replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_match, body: string) => (
      body.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_item, text: string) => `- ${text.trim()}\n`)
    ))
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<\/?(?:div|table|thead|tbody|tfoot|tr|td|th|ol|ul|p)\b[^>]*>/gi, "\n")
    .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Remove repository navigation and old prompt scaffolding from the teaching
 * view without mutating the exact locally stored document. */
function curriculumContent(source: CurriculumSource) {
  let content = source.content;
  const firstTeachingHeading = source.id === "24-blocks-general-readme-md"
    ? "# The Anatomy of a Screenplay"
    : content.match(/^#\s+.+$/m)?.[0];
  if (firstTeachingHeading) {
    const start = content.indexOf(firstTeachingHeading);
    if (start >= 0) content = content.slice(start);
  }
  if (source.id === "24-blocks-loglines-loglines-md") {
    const promptStart = content.indexOf("## Prompt 1");
    const exampleStart = content.indexOf("## Example Output");
    if (promptStart >= 0) {
      content = `${content.slice(0, promptStart).trim()}${exampleStart >= 0 ? `\n\n${content.slice(exampleStart).trim()}` : ""}`;
    }
  }
  return content;
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function beginsBlock(lines: readonly string[], index: number) {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return /^\s*```/.test(line)
    || /^\s{0,3}#{1,6}\s+/.test(line)
    || /^\s*>/.test(line)
    || /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)
    || /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)
    || (line.includes("|") && isTableDivider(next));
}

function parseSource(content: string): readonly SourceBlock[] {
  const lines = readableMarkdown(content).replaceAll("\r\n", "\n").split("\n");
  const blocks: SourceBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```\s*([^\s`]*)/);
    if (fence) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ kind: "code", language: fence[1] ?? "", text: body.join("\n") });
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      const headings = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ kind: "table", headings, rows });
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push({ kind: "quote", lines: quoteLines });
      continue;
    }

    const orderedItem = line.match(/^\s*(\d+)[.)]\s+(.+)/);
    const unorderedItem = line.match(/^\s*[-*+]\s+(.+)/);
    if (orderedItem || unorderedItem) {
      const ordered = Boolean(orderedItem);
      const start = orderedItem ? Number(orderedItem[1]) : undefined;
      const items: string[] = [];
      const itemPattern = ordered ? /^\s*\d+[.)]\s+(.+)/ : /^\s*[-*+]\s+(.+)/;
      while (index < lines.length) {
        const item = lines[index].match(itemPattern);
        if (!item) break;
        items.push(item[1].trim());
        index += 1;
        while (index < lines.length && lines[index].trim() && !beginsBlock(lines, index)) {
          items[items.length - 1] += ` ${lines[index].trim()}`;
          index += 1;
        }
        while (index < lines.length && !lines[index].trim()) index += 1;
      }
      blocks.push({ kind: "list", items, ordered, start });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !beginsBlock(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function localReference(
  label: string,
  href: string,
  key: string,
  { onOpenLesson, resolveLocalReference }: InlineRenderContext,
): ReactNode {
  const target = resolveLocalReference(href.trim().replace(/^<|>$/g, ""));
  if (!target) {
    return <span data-source-recorded-reference key={key}>{label}</span>;
  }
  return (
    <button
      data-source-local-link
      key={key}
      onClick={() => onOpenLesson(target.lessonId)}
      title={`Open the bundled material in ${target.lessonTitle}`}
      type="button"
    >
      {label || target.sourceTitle}
      <span className="sr-only"> in {target.lessonTitle}</span>
    </button>
  );
}

function renderInline(text: string, context: InlineRenderContext): readonly ReactNode[] {
  const parts = text.split(/(!?\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|https?:\/\/[^\s<]+)/g);
  return parts.filter(Boolean).map((part, index) => {
    const image = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      return <span data-source-recorded-reference key={`${index}-${part}`}>{image[1] ? `Image: ${image[1]}` : "Archived image reference"}</span>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return localReference(link[1], link[2], `${index}-${part}`, context);
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={`${index}-${part}`}>{part.slice(1, -1)}</em>;
    }
    if (/^https?:\/\//.test(part)) {
      const target = context.resolveLocalReference(part);
      return localReference(
        target?.sourceTitle ?? "Reference retained in the exact local archive",
        part,
        `${index}-${part}`,
        context,
      );
    }
    return part;
  });
}

function SourceBlocks({ content, ...context }: { readonly content: string } & InlineRenderContext) {
  return parseSource(content).map((block, index) => {
    const key = `${index}-${block.kind}`;
    if (block.kind === "heading") {
      const Heading = block.level === 1 ? "h2" : block.level === 2 ? "h3" : block.level === 3 ? "h4" : "h5";
      return <Heading key={key}>{renderInline(block.text, context)}</Heading>;
    }
    if (block.kind === "paragraph") return <p key={key}>{renderInline(block.text, context)}</p>;
    if (block.kind === "rule") return <hr key={key} />;
    if (block.kind === "code") {
      return <pre data-language={block.language || undefined} key={key}><code>{block.text}</code></pre>;
    }
    if (block.kind === "quote") {
      return <blockquote key={key}>{block.lines.map((line, lineIndex) => <p key={`${lineIndex}-${line}`}>{renderInline(line, context)}</p>)}</blockquote>;
    }
    if (block.kind === "list") {
      const items = block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{renderInline(item, context)}</li>);
      return block.ordered
        ? <ol key={key} start={block.start}>{items}</ol>
        : <ul key={key}>{items}</ul>;
    }
    return (
      <div data-source-table-scroll key={key} role="region" aria-label="Source table" tabIndex={0}>
        <table>
          <thead><tr>{block.headings.map((heading, cellIndex) => <th key={`${cellIndex}-${heading}`} scope="col">{renderInline(heading, context)}</th>)}</tr></thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join("|")}`}>
                {row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>{renderInline(cell, context)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  });
}

/**
 * Render imported teaching as part of the lesson itself. The exact source text
 * stays immutable in learn/*.json for integrity and local retrieval, but a
 * student never has to open a provenance card or leave PlotPickle to learn it.
 */
export function CurriculumMaterial({ onOpenLesson, resolveLocalReference, source }: CurriculumMaterialProps) {
  return (
    <div data-integrated-curriculum-content data-source-id={source.id}>
      <SourceBlocks content={curriculumContent(source)} onOpenLesson={onOpenLesson} resolveLocalReference={resolveLocalReference} />
    </div>
  );
}
