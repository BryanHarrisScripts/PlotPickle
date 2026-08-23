"use client";

import { AFTERGLOW_EXAMPLE_LABEL } from "@/lib/afterglow-example";
import styles from "./afterglow-example-boundary.module.css";

type Props = {
  working?: boolean;
  onMakeCopy: () => void;
  onReset: () => void;
  onOpenGraphicNovel: () => void;
};

export default function AfterglowExampleBoundary({
  working = false,
  onMakeCopy,
  onReset,
  onOpenGraphicNovel,
}: Props) {
  return (
    <section className={styles.banner} aria-labelledby="afterglow-example-title">
      <div className={styles.identity}>
        <span className={styles.lock} aria-hidden="true">Read only</span>
        <div>
          <p>PlotPickle example project</p>
          <strong id="afterglow-example-title">{AFTERGLOW_EXAMPLE_LABEL}</strong>
          <small>
            Explore its blocks, screenplay, characters, visuals and sample Graphic Novel. The bundled source and its repository are never a destination for your work.
          </small>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={working} onClick={onMakeCopy}>
          {working ? "Creating local copy…" : "Make My Own Copy"}
        </button>
        <button type="button" disabled={working} onClick={onOpenGraphicNovel}>Open Sample Graphic Novel</button>
        <button type="button" disabled={working} onClick={onReset}>Reset Example</button>
      </div>
    </section>
  );
}
