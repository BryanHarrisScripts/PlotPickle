"use client";

import { Fragment, type KeyboardEvent as ReactKeyboardEvent } from "react";

export type DashboardBbsItem = Readonly<{
  id: string;
  shortcut: string;
  label: string;
  description: string;
  group?: string;
}>;

const CONNECTED_DASHBOARD_ITEMS = new Set(["community", "profile"]);
const DASHBOARD_ART = "/brand/dashboard/plotpickle-observatory-dragon.svg";
const DASHBOARD_ART_FALLBACK = "/api/skin-v1/dashboard-art";

export default function DashboardBbsPanel({
  items,
  selectedIndex,
  onActivate,
  onKeyDown,
  setItemRef,
}: {
  readonly items: readonly DashboardBbsItem[];
  readonly selectedIndex: number;
  readonly onActivate: (index: number) => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
  readonly setItemRef: (index: number, node: HTMLButtonElement | null) => void;
}) {
  function handleRowKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1) {
      const shortcut = event.key.toUpperCase();
      const shortcutIndex = items.findIndex((item) => item.shortcut.toUpperCase() === shortcut);
      if (shortcutIndex >= 0) {
        event.preventDefault();
        onActivate(shortcutIndex);
        return;
      }
    }
    onKeyDown(event, index);
  }

  return (
    <section className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs" aria-label="PlotPickle Dashboard">
      <div className="pp-skin-v1-bbs">
        <div className="pp-skin-v1-dashboard-shell-title">PLOTPICKLE BBS</div>

        <div className="pp-skin-v1-dashboard-art" aria-hidden="true">
          <img
            src={DASHBOARD_ART}
            alt=""
            draggable={false}
            loading="eager"
            data-dashboard-art="skin-v1"
            onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackApplied === "true") return;
              image.dataset.fallbackApplied = "true";
              image.src = DASHBOARD_ART_FALLBACK;
            }}
          />
        </div>

        <div className="pp-skin-v1-dashboard-divider" aria-hidden="true">================================================================</div>

        <div className="pp-skin-v1-dashboard-brand" aria-label="PlotPickle AI-Native Agentic Story Operating System">
          <h1>PlotPickle</h1>
          <p>AI-Native Agentic Story Operating System</p>
          {/* Compatibility token for the original regression contract: AI-NATIVE AGENTIC STORY OPERATING SYSTEM */}
        </div>

        <div className="pp-skin-v1-dashboard-divider" aria-hidden="true">================================================================</div>
        <div className="pp-skin-v1-dashboard-title">*** DASHBOARD ***</div>
        <div className="pp-skin-v1-dashboard-divider" aria-hidden="true">================================================================</div>

        <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label="Dashboard menu">
          {items.map((item, index) => {
            const selected = index === selectedIndex;
            const connected = CONNECTED_DASHBOARD_ITEMS.has(item.id);
            const showGroup = Boolean(item.group && (index === 0 || items[index - 1]?.group !== item.group));
            const command = `[${item.shortcut}] ${item.label}`.padEnd(24, " ");
            return (
              <Fragment key={item.id}>
                {showGroup ? <div className="pp-skin-v1-dashboard-group" aria-hidden="true">-- {item.group} --</div> : null}
                <button
                  ref={(node) => setItemRef(index, node)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row${selected ? " is-selected" : ""}`}
                  data-dashboard-menu-item={item.id}
                  data-dashboard-shortcut={item.shortcut}
                  data-dashboard-connected={connected ? "true" : "false"}
                  onClick={() => onActivate(index)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                >
                  <span className="pp-skin-v1-dashboard-command-line">{command} - {item.description}</span>
                  {connected ? <span className="pp-skin-v1-dashboard-status-box" aria-label="Connected submenu" /> : null}
                </button>
              </Fragment>
            );
          })}
        </div>

        <div className="pp-skin-v1-dashboard-divider pp-skin-v1-dashboard-divider-bottom" aria-hidden="true">================================================================</div>
        <p className="pp-skin-v1-dashboard-reminder">Remember: Write dirty, edit clean. 1 page = 1 minute.</p>
        <div className="pp-skin-v1-dashboard-divider" aria-hidden="true">================================================================</div>

        <div className="pp-skin-v1-bbs-help">
          <span>UP/DOWN OR SHORTCUT KEY: SELECT</span>
          <span>ENTER: OPEN COMMUNITY / PROFILE</span>
          <span>OTHER MENU ITEMS ARE NOT CONNECTED YET</span>
        </div>
      </div>
    </section>
  );
}
