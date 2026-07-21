import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import CurrentDownloadLinks from "./current-download-links";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlotPickle Playhouse — Download the 24 Blocks Story Planner",
  description:
    "Download PlotPickle Playhouse for Windows: a local-first story planner connecting Instructions, Story Planner, Resonance Engine, Voiceprint Engine, PageFlow Engine, DraftLens Engine, CraftLoop Engine, and Visual Board through Bryan Harris's 24 Blocks method.",
  other: {
    "codex-preview": "development",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon/plotpickle-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon/plotpickle-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/favicon/plotpickle-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/brand/favicon/favicon.ico",
    apple: "/brand/favicon/apple-touch-icon-180.png",
  },
};

const engineLinkStyle = {
  border: "1px solid #bcd9d8",
  borderRadius: 999,
  background: "rgba(248, 255, 254, 0.94)",
  boxShadow: "0 12px 28px rgba(32, 79, 86, 0.18)",
  color: "#204f56",
  fontSize: 13,
  fontWeight: 800,
  padding: "10px 15px",
  textDecoration: "none",
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <CurrentDownloadLinks />
        <nav
          aria-label="PlotPickle writing engines"
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <Link href="/craftloop" style={engineLinkStyle}>CraftLoop Engine</Link>
          <Link href="/draftlens" style={engineLinkStyle}>DraftLens Engine</Link>
          <Link href="/resonance" style={engineLinkStyle}>Resonance Engine</Link>
          <Link href="/pageflow" style={engineLinkStyle}>PageFlow Engine</Link>
          <Link href="/voiceprint" style={engineLinkStyle}>Voiceprint Engine</Link>
        </nav>
      </body>
    </html>
  );
}
