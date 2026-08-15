"use client";

import Image from "next/image";
import styles from "./wyrmwood-plugin-entry.module.css";

export default function WyrmwoodPluginEntry({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <button
      aria-label="Open Wyrmwood game"
      className={styles.entry}
      onClick={onOpen}
      type="button"
    >
      <Image
        alt=""
        aria-hidden="true"
        className={styles.glyph}
        height={58}
        src="/assets/workflow-relics/game.webp"
        width={58}
      />
      <span className={styles.label}>WYRMWOOD</span>
    </button>
  );
}
