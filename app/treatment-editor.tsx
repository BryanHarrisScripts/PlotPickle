"use client";

import { ReactNode, useMemo, useRef, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import styles from "./treatment-editor.module.css";

type Props = {
  project: PlotPickleProject;
  blockNumber: number;
  miniBlockNumber: number;
  onBlockChange: (blockNumber: number) => void;
  onMiniBlockChange: (miniBlockNumber: number) => void;
  onProjectChange: (project: PlotPickleProject) => void;
  onOpenBlock: (blockNumber: number) => void;
  onSendToScreenplay: (text: string) => void;
};

type AiResponse = { text?: string; message?: string };

function download(name: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "treatment";
}

function miniBlocks(project: PlotPickleProject, blockNumber: number) {
  return project.blocks[blockNumber - 1].scenes.flatMap((scene) => scene.miniBlocks);
}

function plainText(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+(?:\[[ xX]\]\s*)?/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wordCount(value: string) {
  return plainText(value).split(/\s+/).filter(Boolean).length;
}

function inlineMarkdown(value: string) {
  const tokens = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g).filter(Boolean);
  return tokens.map((token, index): ReactNode => {
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("*") && token.endsWith("*")) return <em key={index}>{token.slice(1, -1)}</em>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={index}>{token.slice(1, -1)}</code>;
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a href={link[2]} target="_blank" rel="noreferrer" key={index}>{link[1]}</a>;
    return token;
  });
}

function MarkdownPreview({ value }: { value: string }) {
  if (!value.trim()) return <div className={styles.emptyPreview}><strong>Your treatment will appear here.</strong><span>Write freely in Markdown, then move the finished prose into the screenplay.</span></div>;
  return <div className={styles.previewContent}>{value.split("\n").map((line, index) => {
    if (!line.trim()) return <div className={styles.previewSpace} key={index} />;
    if (/^###\s+/.test(line)) return <h3 key={index}>{inlineMarkdown(line.replace(/^###\s+/, ""))}</h3>;
    if (/^##\s+/.test(line)) return <h2 key={index}>{inlineMarkdown(line.replace(/^##\s+/, ""))}</h2>;
    if (/^#\s+/.test(line)) return <h1 key={index}>{inlineMarkdown(line.replace(/^#\s+/, ""))}</h1>;
    if (/^---+$/.test(line.trim())) return <hr key={index} />;
    if (/^>\s?/.test(line)) return <blockquote key={index}>{inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>;
    const task = line.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (task) return <div className={styles.task} key={index}><span>{task[1].toLowerCase() === "x" ? "✓" : "○"}</span><p>{inlineMarkdown(task[2])}</p></div>;
    const item = line.match(/^[-*+]\s+(.*)$/);
    if (item) return <div className={styles.listItem} key={index}><span>•</span><p>{inlineMarkdown(item[1])}</p></div>;
    return <p key={index}>{inlineMarkdown(line)}</p>;
  })}</div>;
}

export default function TreatmentEditor({ project, blockNumber, miniBlockNumber, onBlockChange, onMiniBlockChange, onProjectChange, onOpenBlock, onSendToScreenplay }: Props) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(true);
  const [aiState, setAiState] = useState<"idle" | "working" | "error">("idle");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const block = project.blocks[blockNumber - 1];
  const minis = miniBlocks(project, blockNumber);
  const mini = minis[miniBlockNumber - 1];
  const markdown = mini.notes;
  const totalWords = useMemo(() => project.blocks.reduce((sum, item) => sum + item.scenes.flatMap((scene) => scene.miniBlocks).reduce((miniSum, current) => miniSum + wordCount(current.notes), 0), 0), [project]);

  function updateMarkdown(value: string) {
    onProjectChange({
      ...project,
      blocks: project.blocks.map((item) => item.number !== blockNumber ? item : {
        ...item,
        scenes: item.scenes.map((scene) => ({
          ...scene,
          miniBlocks: scene.miniBlocks.map((current) => current.number === miniBlockNumber ? { ...current, notes: value } : current),
        })),
      }),
    });
  }

  function insert(before: string, after = before, placeholder = "text") {
    const textarea = editor.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = markdown.slice(start, end) || placeholder;
    updateMarkdown(`${markdown.slice(0, start)}${before}${selection}${after}${markdown.slice(end)}`);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selection.length);
    }, 0);
  }

  function completeTreatment() {
    return project.blocks.map((item) => {
      const sections = item.scenes.flatMap((scene) => scene.miniBlocks).map((current) => `### ${item.number}.${current.number} ${current.label}\n\n${current.notes.trim() || "_Not written yet._"}`);
      return `## Block ${item.number}: ${item.title}\n\n${item.purpose}\n\n${sections.join("\n\n")}`;
    }).join("\n\n---\n\n");
  }

  async function cleanWithAi() {
    if (!markdown.trim() || aiState === "working") return;
    setAiState("working");
    setAiSuggestion("");
    try {
      const response = await fetch("/api/local-ai/generate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions: "Edit the writer's treatment for spelling, grammar, clarity and flow. Preserve every story decision and the writer's voice. Return only clean Markdown. Do not add plot, characters or claims.",
          prompt: `Project: ${project.metadata.title}\nBlock ${block.number}: ${block.title}\nMini-block ${block.number}.${mini.number}: ${mini.label}\nFunction: ${mini.function}\n\nWriter's treatment:\n${markdown}`,
        }),
      });
      const result = await response.json() as AiResponse;
      if (!response.ok || !result.text) throw new Error(result.message || "AI returned no revision.");
      setAiSuggestion(result.text);
      setAiState("idle");
    } catch (error) {
      setAiSuggestion(error instanceof Error ? error.message : "AI cleanup is unavailable.");
      setAiState("error");
    }
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span>Markdown Treatment</span><h1>Develop the story before formatting the script.</h1><p>Each of the 96 mini-blocks has a connected writing space. The same story position later drives screenplay pages and storyboard prompts.</p></div>
      <div className={styles.stats}><strong>{totalWords.toLocaleString()}</strong><span>treatment words</span><small>{wordCount(markdown)} in Block {block.number}.{miniBlockNumber}</small></div>
    </header>

    <div className={styles.layout}>
      <aside className={styles.blockRail}>
        <div><span>Story path</span><strong>24 Blocks</strong><small>Select a Block and one of its four movements.</small></div>
        <nav aria-label="Treatment blocks">{project.blocks.map((item) => {
          const count = item.scenes.flatMap((scene) => scene.miniBlocks).reduce((sum, current) => sum + wordCount(current.notes), 0);
          return <button type="button" className={item.number === blockNumber ? styles.activeBlock : ""} onClick={() => { onBlockChange(item.number); onMiniBlockChange(1); }} key={item.id}><span>{String(item.number).padStart(2, "0")}</span><strong>{item.title}</strong><small>{count ? `${count} words` : "Not written"}</small></button>;
        })}</nav>
      </aside>

      <main className={styles.main}>
        <section className={styles.context}>
          <div><span>Act {block.act} · Block {block.number}</span><h2>{block.title}</h2><p>{block.purpose}</p></div>
          <button type="button" onClick={() => onOpenBlock(block.number)}>Open Block plan</button>
          <div className={styles.miniGrid}>{minis.map((item) => <button type="button" className={item.number === miniBlockNumber ? styles.activeMini : ""} onClick={() => onMiniBlockChange(item.number)} key={item.id}><span>{block.number}.{item.number}</span><strong>{item.label}</strong><small>{item.function}</small><i>{wordCount(item.notes) ? `${wordCount(item.notes)} words` : "Empty"}</i></button>)}</div>
        </section>

        <section className={styles.editorCard}>
          <div className={styles.toolbar}>
            <span>Write Block {block.number}.{miniBlockNumber}</span>
            <button type="button" title="Heading" onClick={() => insert("## ", "", "Section heading")}>H2</button>
            <button type="button" title="Bold" onClick={() => insert("**", "**", "important")}>Bold</button>
            <button type="button" title="Italic" onClick={() => insert("*", "*", "emphasis")}>Italic</button>
            <button type="button" title="Bullet list" onClick={() => insert("- ", "", "story point")}>List</button>
            <button type="button" title="Task" onClick={() => insert("- [ ] ", "", "revision task")}>Task</button>
            <button type="button" title="Quote" onClick={() => insert("> ", "", "key thought")}>Quote</button>
            <button type="button" className={preview ? styles.active : ""} onClick={() => setPreview((value) => !value)}>{preview ? "Hide preview" : "Show preview"}</button>
          </div>
          <div className={preview ? styles.editorSplit : styles.editorOnly}>
            <textarea ref={editor} value={markdown} onChange={(event) => updateMarkdown(event.target.value)} placeholder={`## ${mini.label}\n\nDescribe what happens, what the character wants, the pressure they meet, and the visible turn that carries us forward.`} aria-label={`Markdown treatment for Block ${block.number}.${mini.number}`} />
            {preview ? <div className={styles.preview} aria-label="Markdown preview"><MarkdownPreview value={markdown} /></div> : null}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => download(`${slug(project.metadata.title)}-block-${block.number}-${mini.number}.md`, markdown)}>Export section</button>
            <button type="button" onClick={() => download(`${slug(project.metadata.title)}-complete-treatment.md`, `# ${project.metadata.title}\n\n${completeTreatment()}`)}>Export complete treatment</button>
            <button type="button" onClick={cleanWithAi} disabled={!markdown.trim() || aiState === "working"}>{aiState === "working" ? "Cleaning…" : "Clean up with AI"}</button>
            <button type="button" className={styles.primary} onClick={() => onSendToScreenplay(plainText(markdown))} disabled={!markdown.trim()}>Send to screenplay as action</button>
          </div>
          <small className={styles.ownership}>Treatment text stays in the local PlotPickle project. AI is optional and changes nothing until you approve it.</small>
        </section>

        {aiSuggestion ? <section className={aiState === "error" ? styles.aiError : styles.aiReview}><div><span>{aiState === "error" ? "AI cleanup unavailable" : "Review suggested cleanup"}</span><p>{aiSuggestion}</p></div>{aiState !== "error" ? <div><button type="button" onClick={() => { updateMarkdown(aiSuggestion); setAiSuggestion(""); }}>Approve revision</button><button type="button" onClick={() => setAiSuggestion("")}>Keep original</button></div> : <button type="button" onClick={() => setAiSuggestion("")}>Dismiss</button>}</section> : null}
      </main>
    </div>
  </div>;
}
