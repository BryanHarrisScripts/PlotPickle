"use client";

import Link from "next/link";

export default function RefineReturnNav() {
  function goBack() {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/?workspace=refine");
  }

  return (
    <nav
      aria-label="Refine navigation"
      style={{
        position: "sticky",
        top: 8,
        zIndex: 40,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        marginBottom: 14,
        padding: 10,
        border: "1px solid #c6d8d4",
        borderRadius: 14,
        background: "rgba(249, 253, 252, 0.96)",
        boxShadow: "0 8px 24px rgba(28, 55, 50, 0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <button type="button" onClick={goBack} style={{ border: "1px solid #9fbdb7", borderRadius: 999, background: "#fff", padding: "8px 12px", fontWeight: 800, color: "#214b44", cursor: "pointer" }}>Back one screen</button>
      <Link href="/?workspace=refine" style={{ border: "1px solid #9fbdb7", borderRadius: 999, background: "#eef8f5", padding: "8px 12px", fontWeight: 800, color: "#214b44", textDecoration: "none" }}>Refine menu</Link>
      <Link href="/?workspace=dashboard" style={{ border: "1px solid #9fbdb7", borderRadius: 999, background: "#fff", padding: "8px 12px", fontWeight: 800, color: "#214b44", textDecoration: "none" }}>Main menu</Link>
    </nav>
  );
}
