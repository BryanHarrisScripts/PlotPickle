"use client";

import { useMemo, useState } from "react";
import styles from "./mini-block-wall.module.css";
import mapStyles from "./storyworld-map-panel.module.css";
import type { MiniBlockWallCard, MiniBlockWallState } from "@/lib/mini-block-wall";
import type { PlotPickleProject } from "@/lib/project";
import {
  buildStoryworldMapHtml,
  buildStoryworldMapSvg,
  createStoryworldMapItems,
  createStoryworldMapModel,
  saveStoryworldMapSharedLayout,
  STORYWORLD_MAP_OVERLAYS,
  storyworldConnectionsForItem,
  storyworldMapFileName,
  storyworldMarkersForItem,
  type StoryworldMapItem,
  type StoryworldMapOverlay,
} from "@/lib/storyworld-map";

type StoryworldMapPanelProps = {
  project: PlotPickleProject;
  state: MiniBlockWallState;
  visibleCards: MiniBlockWallCard[];
  selectedCard: MiniBlockWallCard | undefined;
  onProjectChange: (project: PlotPickleProject) => void;
  onOpenBlock: (number: number) => void;
  onSelectCard: (card: MiniBlockWallCard, focus?: boolean) => void;
  onUpdateState: (patch: Partial<MiniBlockWallState>) => void;
};

const GRANULARITIES: Array<{ id: MiniBlockWallState["granularity"]; label: string }> = [
  { id: "movie", label: "Whole movie" },
  { id: "act", label: "Act" },
  { id: "sequence", label: "Sequence" },
  { id: "block", label: "Block" },
  { id: "scene", label: "Scene" },
  { id: "mini-block", label: "Mini-block" },
  { id: "production-shot", label: "Production Shot" },
];

function downloadText(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function otherMiniBlockId(item: StoryworldMapItem, from: string, to: string) {
  const members = new Set(item.miniBlockIds);
  return members.has(from) ? to : from;
}

export default function StoryworldMapPanel({
  project,
  state,
  visibleCards,
  selectedCard,
  onProjectChange,
  onOpenBlock,
  onSelectCard,
  onUpdateState,
}: StoryworldMapPanelProps) {
  const model = useMemo(() => createStoryworldMapModel(project), [project]);
  const items = useMemo(
    () => createStoryworldMapItems(project, model, state.granularity, visibleCards.map((card) => card.id)),
    [project, model, state.granularity, visibleCards],
  );
  const selectedFromCard = items.find((item) => selectedCard && item.miniBlockIds.includes(selectedCard.id));
  const [selectedItemId, setSelectedItemId] = useState("");
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? selectedFromCard ?? items[0];
  const selectedConnections = selectedItem ? storyworldConnectionsForItem(model, selectedItem, state.overlays) : [];
  const selectedMarkers = selectedItem ? storyworldMarkersForItem(model, selectedItem, state.overlays) : [];
  const itemByMiniBlock = useMemo(() => {
    const result = new Map<string, StoryworldMapItem>();
    items.forEach((item) => item.miniBlockIds.forEach((id) => {
      if (!result.has(id)) result.set(id, item);
    }));
    return result;
  }, [items]);

  function selectItem(item: StoryworldMapItem) {
    setSelectedItemId(item.id);
    const card = model.cards.find((candidate) => item.miniBlockIds.includes(candidate.id));
    if (card) onSelectCard(card);
  }

  function toggleOverlay(overlay: StoryworldMapOverlay) {
    const overlays = state.overlays.includes(overlay)
      ? state.overlays.filter((item) => item !== overlay)
      : [...state.overlays, overlay];
    onUpdateState({ overlays });
  }

  function saveSharedLayout() {
    onProjectChange(saveStoryworldMapSharedLayout(project, {
      mode: state.display === "map" ? "map" : "wall",
      granularity: state.granularity,
      overlays: state.overlays,
      emphasizedNodeIds: selectedItem ? [selectedItem.canonicalId] : [],
    }));
  }

  const summary = `${items.length} ${state.granularity} item${items.length === 1 ? "" : "s"}, ${selectedConnections.length} visible connections and ${selectedMarkers.length} selected signals.`;

  return (
    <section className={styles.storyworldWorkspace} aria-label="Interactive Storyworld Map">
      <header className={styles.mapHeader}>
        <div>
          <p>Derived PPF relationship view</p>
          <h2>{state.display === "table" ? "Storyworld Map table" : "Interactive Storyworld Map"}</h2>
          <span>Explore canonical story logic without creating or reordering project records.</span>
        </div>
        <div className={styles.mapSummary} aria-label="Storyworld Map summary">
          <strong>{items.length}</strong><span>{state.granularity} items</span>
          <strong>{model.summary.connections}</strong><span>derived connections</span>
        </div>
      </header>

      <section className={styles.mapControls} aria-label="Storyworld Map controls">
        <label><span>Semantic zoom</span><select value={state.granularity} onChange={(event) => onUpdateState({ granularity: event.target.value as MiniBlockWallState["granularity"] })}>{GRANULARITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Search story evidence</span><input type="search" value={state.search} placeholder="Hook, turn, character, location…" onChange={(event) => onUpdateState({ search: event.target.value })} /></label>
        <div className={mapStyles.mapViewportTools} role="group" aria-label="Local map viewport controls">
          <button type="button" onClick={() => onUpdateState({ zoom: state.zoom - .1 })}>Zoom out</button>
          <span>{Math.round(state.zoom * 100)}%</span>
          <button type="button" onClick={() => onUpdateState({ zoom: state.zoom + .1 })}>Zoom in</button>
          <button type="button" aria-label="Pan map left" onClick={() => onUpdateState({ pan: { ...state.pan, x: state.pan.x + 80 } })}>←</button>
          <button type="button" aria-label="Pan map up" onClick={() => onUpdateState({ pan: { ...state.pan, y: state.pan.y + 80 } })}>↑</button>
          <button type="button" aria-label="Pan map down" onClick={() => onUpdateState({ pan: { ...state.pan, y: state.pan.y - 80 } })}>↓</button>
          <button type="button" aria-label="Pan map right" onClick={() => onUpdateState({ pan: { ...state.pan, x: state.pan.x - 80 } })}>→</button>
          <button type="button" onClick={() => onUpdateState({ zoom: 1, pan: { x: 0, y: 0 } })}>Reset viewport</button>
        </div>
        <button type="button" onClick={saveSharedLayout}>Save shared layout</button>
        <button type="button" onClick={() => downloadText(storyworldMapFileName(project, "svg"), buildStoryworldMapSvg(project, model, state.overlays), "image/svg+xml")}>Export SVG</button>
        <button type="button" onClick={() => downloadText(storyworldMapFileName(project, "html"), buildStoryworldMapHtml(project, model), "text/html")}>Export HTML</button>
      </section>

      <fieldset className={styles.overlayLegend}>
        <legend>Relationship overlays</legend>
        {STORYWORLD_MAP_OVERLAYS.map((overlay) => (
          <label key={overlay.id} data-overlay={overlay.id}>
            <input type="checkbox" checked={state.overlays.includes(overlay.id)} onChange={() => toggleOverlay(overlay.id)} />
            <b aria-hidden="true">{overlay.symbol}</b>
            <span>{overlay.label}</span>
          </label>
        ))}
      </fieldset>

      <p className={styles.screenReaderSummary} role="status" aria-live="polite">{summary}</p>

      <div className={styles.mapLayout}>
        <div className={styles.mapViewport}>
          {state.display === "table" ? (
            <div className={styles.mapTableWrap}>
              <table className={styles.mapTable}>
                <caption>Canonical Storyworld Map index. Selecting a row opens the same record in the evidence inspector.</caption>
                <thead><tr><th>Type</th><th>Story item</th><th>Context</th><th>Connections</th><th>Signals</th><th>Canonical ID</th></tr></thead>
                <tbody>{items.map((item) => {
                  const connections = storyworldConnectionsForItem(model, item, state.overlays);
                  const markers = storyworldMarkersForItem(model, item, state.overlays);
                  return <tr key={item.id} className={item.id === selectedItem?.id ? styles.mapTableSelected : ""}><td>{item.kind}</td><th scope="row"><button type="button" onClick={() => selectItem(item)}>{item.label}</button></th><td>{item.context}</td><td>{connections.length}</td><td>{markers.map((marker) => marker.label).join(", ") || "None"}</td><td><code>{item.canonicalId}</code></td></tr>;
                })}</tbody>
              </table>
            </div>
          ) : (
            <div className={styles.mapGrid} data-granularity={state.granularity} style={{ transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`, transformOrigin: "0 0" }}>
              {items.map((item) => {
                const connections = storyworldConnectionsForItem(model, item, state.overlays);
                const markers = storyworldMarkersForItem(model, item, state.overlays);
                const connectionOverlays = STORYWORLD_MAP_OVERLAYS.filter((overlay) =>
                  connections.some((connection) => connection.overlay === overlay.id));
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`${styles.mapNode} ${item.id === selectedItem?.id ? styles.mapNodeSelected : ""}`}
                    data-act={item.act}
                    onClick={() => selectItem(item)}
                    aria-pressed={item.id === selectedItem?.id}
                    aria-label={`${item.label}. ${connections.length} visible connections. ${markers.length} signals.`}
                  >
                    <span>{item.kind}</span>
                    <strong>{item.label}</strong>
                    <small>{item.context}</small>
                    <span className={mapStyles.mapNodeLinks} aria-label={`${connectionOverlays.length} relationship types`}>
                      {connectionOverlays.map((overlay) => <b key={overlay.id} data-overlay={overlay.id} title={overlay.label}>{overlay.symbol}<i>{overlay.label}</i></b>)}
                    </span>
                    <i>{connections.length} links · {markers.length} signals</i>
                  </button>
                );
              })}
              {!items.length ? <p className={styles.empty}>No canonical records match the current filters at this level.</p> : null}
            </div>
          )}
        </div>

        <aside className={styles.mapInspector} aria-label="Storyworld connection evidence">
          {selectedItem ? <>
            <header><div><p>{selectedItem.kind} evidence</p><h3>{selectedItem.label}</h3></div><span>{selectedItem.miniBlockIds.length} mini-block{selectedItem.miniBlockIds.length === 1 ? "" : "s"}</span></header>
            <p className={styles.contextLine}>{selectedItem.context} · stable ID {selectedItem.canonicalId}</p>
            <section className={styles.evidenceSection}>
              <strong>Show why this connects</strong>
              {selectedConnections.length ? selectedConnections.slice(0, 40).map((connection) => {
                const target = itemByMiniBlock.get(otherMiniBlockId(selectedItem, connection.fromMiniBlockId, connection.toMiniBlockId));
                return <button type="button" key={connection.id} data-overlay={connection.overlay} onClick={() => target && selectItem(target)}><span><b>{connection.label}</b><em>{connection.source}</em></span><small>{connection.evidence}</small><code>{connection.sourceNodeIds.join(" → ")}</code></button>;
              }) : <p>No selected overlay connects this item to another visible story item.</p>}
            </section>
            <section className={styles.signalSection}>
              <strong>Signals on this item</strong>
              {selectedMarkers.length ? selectedMarkers.map((marker) => <article key={marker.id} data-severity={marker.severity}><span>{marker.label}</span><p>{marker.evidence}</p></article>) : <p>No selected signals.</p>}
            </section>
            {selectedItem.blockNumber ? <button type="button" className={styles.primary} onClick={() => onOpenBlock(selectedItem.blockNumber)}>Open owning Block in Plan</button> : null}
          </> : <p>No Storyworld Map item is selected.</p>}
        </aside>
      </div>
    </section>
  );
}
