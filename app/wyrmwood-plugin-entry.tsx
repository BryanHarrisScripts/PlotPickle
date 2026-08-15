"use client";

import Image from "next/image";
import styles from "./wyrmwood-plugin-entry.module.css";

export default function WyrmwoodPluginEntry({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <button
      aria-label="Open PLAY — Wyrmwood"
      className={styles.entry}
      onClick={onOpen}
      title="Open PLAY — Wyrmwood"
      type="button"
    >
      <Image alt="" aria-hidden="true" height={44} src="/brand/favicon/plotpickle-ouroboros-v2-128.png" width={44} />
      <span>
        <strong>PLAY</strong>
        <small>Wyrmwood</small>
      </span>
    </button>
  );
}
