"use client";

import { useEffect, useState } from "react";
import styles from "./workspace-intro.module.css";

type WorkspaceIntroProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  sideEyebrow: string;
  sideTitle: string;
  sideDescription: string;
  embedded?: boolean;
};

export default function WorkspaceIntro({
  id,
  eyebrow,
  title,
  description,
  sideEyebrow,
  sideTitle,
  sideDescription,
  embedded = false,
}: WorkspaceIntroProps) {
  const storageKey = `plotpickle.workspace-intro.collapsed:${id}`;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(storageKey) === "true");
    } catch {
      setCollapsed(false);
    }
  }, [storageKey]);

  function setOverviewCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      // The overview remains usable when browser storage is unavailable.
    }
  }

  if (collapsed) {
    return (
      <section className={`${styles.collapsed} ${embedded ? styles.embedded : ""}`} aria-labelledby={`${id}-collapsed`}>
        <div>
          <span>{eyebrow}</span>
          <strong id={`${id}-collapsed`}>{title}</strong>
        </div>
        <button type="button" aria-expanded="false" onClick={() => setOverviewCollapsed(false)}>
          Show overview
        </button>
      </section>
    );
  }

  return (
    <section className={`${styles.wrap} ${embedded ? styles.embedded : ""}`} aria-labelledby={id}>
      <div className={styles.hero}>
        <div className={styles.primaryCard}>
          <div className={styles.topline}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <button type="button" aria-expanded="true" onClick={() => setOverviewCollapsed(true)}>
              Hide overview
            </button>
          </div>
          <h1 id={id}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <aside className={styles.sideCard}>
          <span>{sideEyebrow}</span>
          <strong>{sideTitle}</strong>
          <p>{sideDescription}</p>
        </aside>
      </div>
    </section>
  );
}
