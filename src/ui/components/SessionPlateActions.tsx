import { useMemo, useState } from "react";
import { composeAnnotation } from "@/content/annotations";
import { conceptById } from "@/content/concepts";
import { disciplineById } from "@/content/disciplines";
import type { Discovery, SessionState } from "@/state/types";
import { Button } from "./Button";

interface Props {
  session: SessionState;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(value: string, maxChars: number): string[] {
  const words = value.split(/\s+/u);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function topDiscovery(discoveries: Discovery[]): Discovery | null {
  return (
    [...discoveries]
      .filter((d) => d.kind === "curated")
      .sort((a, b) => b.tier - a.tier || b.points - a.points)[0] ??
    discoveries[0] ??
    null
  );
}

function pairText(discovery: Discovery | null): string {
  if (!discovery) return "No thread woven";
  const a = conceptById.get(discovery.a);
  const b = conceptById.get(discovery.b);
  return `${a?.name ?? "Unknown"} x ${b?.name ?? "Unknown"}`;
}

function disciplineGlyphs(session: SessionState): string {
  return session.disciplines
    .map((id) => disciplineById.get(id)?.glyph)
    .filter(Boolean)
    .join(" ");
}

function plateText(session: SessionState, annotation: string): string {
  const discovery = topDiscovery(session.discoveries);
  return [
    "The Glass Bead Game",
    `Resonance: ${session.score}`,
    `Discoveries: ${session.discoveries.length}`,
    `Motifs: ${session.motifs.map((m) => m.name).join(", ") || "none"}`,
    discovery ? `Finest thread: ${discovery.title} (${pairText(discovery)})` : "Finest thread: none",
    "",
    annotation,
  ].join("\n");
}

function plateSvg(session: SessionState, annotation: string): string {
  const discovery = topDiscovery(session.discoveries);
  const title = discovery?.title ?? "A Quiet Game";
  const pair = pairText(discovery);
  const annotationLines = wrapText(annotation, 72).slice(0, 5);
  const insightLines = wrapText(discovery?.insight ?? "The beads kept their silence.", 76).slice(0, 5);
  const motifs = session.motifs.map((m) => m.name).join(" / ") || "No motif";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <radialGradient id="bg" cx="50%" cy="44%" r="68%">
      <stop offset="0%" stop-color="#1c2440"/>
      <stop offset="56%" stop-color="#101321"/>
      <stop offset="100%" stop-color="#06090f"/>
    </radialGradient>
    <linearGradient id="line" x1="0%" x2="100%">
      <stop offset="0%" stop-color="#7c5cff" stop-opacity="0"/>
      <stop offset="50%" stop-color="#f6c344" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#2dd4ee" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <circle cx="600" cy="388" r="250" fill="none" stroke="#8f83ff" stroke-opacity="0.16" stroke-width="2"/>
  <path d="M260 392 C430 250 770 250 940 392" fill="none" stroke="url(#line)" stroke-width="4"/>
  <path d="M260 408 C430 550 770 550 940 408" fill="none" stroke="url(#line)" stroke-width="2" opacity="0.45"/>
  <text x="600" y="102" text-anchor="middle" fill="#b4bad2" font-family="Inter, Arial, sans-serif" font-size="16" letter-spacing="10">THE GLASS BEAD GAME</text>
  <text x="600" y="164" text-anchor="middle" fill="#f7f1e8" font-family="Georgia, serif" font-size="62">${escapeXml(title)}</text>
  <text x="600" y="205" text-anchor="middle" fill="#b4bad2" font-family="Inter, Arial, sans-serif" font-size="17" letter-spacing="3">${escapeXml(pair)}</text>
  <text x="600" y="256" text-anchor="middle" fill="#f6c344" font-family="Inter, Arial, sans-serif" font-size="18" letter-spacing="5">${escapeXml(disciplineGlyphs(session))}</text>
  ${annotationLines
    .map(
      (line, i) =>
        `<text x="600" y="${330 + i * 31}" text-anchor="middle" fill="#f7f1e8" font-family="Georgia, serif" font-size="28" font-style="italic">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  <rect x="220" y="520" width="760" height="1" fill="#8f83ff" opacity="0.28"/>
  ${insightLines
    .map(
      (line, i) =>
        `<text x="600" y="${570 + i * 25}" text-anchor="middle" fill="#c7ccde" font-family="Inter, Arial, sans-serif" font-size="18">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  <text x="350" y="724" text-anchor="middle" fill="#f6c344" font-family="Georgia, serif" font-size="38">${session.score}</text>
  <text x="350" y="754" text-anchor="middle" fill="#b4bad2" font-family="Inter, Arial, sans-serif" font-size="13" letter-spacing="5">RESONANCE</text>
  <text x="600" y="724" text-anchor="middle" fill="#f7f1e8" font-family="Georgia, serif" font-size="38">${session.discoveries.length}</text>
  <text x="600" y="754" text-anchor="middle" fill="#b4bad2" font-family="Inter, Arial, sans-serif" font-size="13" letter-spacing="5">DISCOVERIES</text>
  <text x="850" y="724" text-anchor="middle" fill="#f7f1e8" font-family="Georgia, serif" font-size="28">${escapeXml(motifs)}</text>
  <text x="850" y="754" text-anchor="middle" fill="#b4bad2" font-family="Inter, Arial, sans-serif" font-size="13" letter-spacing="5">MOTIF</text>
</svg>`;
}

function download(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SessionPlateActions({ session }: Props) {
  const [copied, setCopied] = useState(false);
  const annotation = useMemo(() => composeAnnotation(session), [session]);
  const text = useMemo(() => plateText(session, annotation), [session, annotation]);
  const svg = useMemo(() => plateSvg(session, annotation), [session, annotation]);

  const copy = async () => {
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => download(`glass-bead-game-${session.seed}.svg`, svg)}
      >
        Download plate
      </Button>
      <Button variant="ghost" onClick={copy}>
        {copied ? "Copied" : "Copy plate text"}
      </Button>
    </>
  );
}
