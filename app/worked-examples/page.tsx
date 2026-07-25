"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { workedExamples } from "../beginner-experience";
import styles from "./worked-examples.module.css";

export default function WorkedExamplesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(workedExamples.map((example) => example.category))];
  const filtered = useMemo(() => workedExamples.filter((example) => {
    const matchesCategory = category === "All" || example.category === category;
    const haystack = `${example.title} ${example.before} ${example.after} ${example.tags.join(" ")}`.toLowerCase();
    return matchesCategory && haystack.includes(query.toLowerCase());
  }), [category, query]);

  function recordUse(id: string) {
    const key = "plotpickle.beginner.examples-used.v1";
    const current: string[] = JSON.parse(localStorage.getItem(key) || "[]");
    localStorage.setItem(key, JSON.stringify([...new Set([...current, id])]));
  }

  return <main className={styles.page}>
    <header><Link href="/start-here">Start Here</Link><h1>Worked examples</h1><p>Each example shows one possible improvement, not the only correct formula. Use the reasoning, then make the material belong to your movie.</p></header>
    <section className={styles.filters}><input aria-label="Search examples" placeholder="Search premise, scene, dialogue, continuity…" value={query} onChange={(e) => setQuery(e.target.value)} /><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></section>
    <section className={styles.grid}>{filtered.map((example) => <article key={example.id} id={example.id}>
      <p className={styles.category}>{example.category}</p><h2>{example.title}</h2>
      <div className={styles.before}><strong>Before or incomplete</strong><p>{example.before}</p></div>
      <div className={styles.unclear}><strong>What is unclear</strong><p>{example.unclear}</p></div>
      <div className={styles.after}><strong>After or stronger</strong><p>{example.after}</p></div>
      <div><strong>Why it works better</strong><p>{example.whyBetter}</p></div>
      <button onClick={() => recordUse(example.id)}>Use this reasoning in my project</button>
    </article>)}</section>
    <footer><Link href="/?workspace=1&tab=learn">Complete Learning Library</Link><Link href="/screenplay-readiness">Is my screenplay ready?</Link></footer>
  </main>;
}
