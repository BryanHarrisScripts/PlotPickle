export default function ComputeReadyMarker({ ready, label = "Resource" }: { ready: boolean; label?: string }) {
  return <svg role="img" aria-label={`${label} ${ready ? "Ready" : "Not ready"}`} width="16" height="16" viewBox="0 0 16 16" style={{ flex: "0 0 auto" }}>
    <circle cx="8" cy="8" r="7" fill={ready ? "#248847" : "var(--pp-skin-surface-3)"} stroke="var(--pp-skin-line)" />
    {ready ? <path d="M4.5 8 7 10.5 11.5 5.5" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /> : null}
  </svg>;
}
