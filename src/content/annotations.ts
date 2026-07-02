import type { DisciplineId } from "./types";
import { disciplineById } from "./disciplines";
import { conceptById } from "./concepts";
import { mulberry32, pick } from "@/lib/utils";
import type { SessionState } from "@/state/types";

/**
 * The Annotation — the written commentary that closes a Game, composed
 * deterministically from what the player actually wove. Assembled from
 * authored fragments; the same session always reads the same.
 */

const OPENINGS: Record<string, string[]> = {
  generic: [
    "The Game is concluded, and the pattern holds.",
    "The last thread settles; the web remembers every gesture.",
    "What began as scattered lights now hangs together, a small constellation of thought.",
  ],
  "mathematics|music": [
    "Number and tone were this Game's poles, as they were the Game's first poles centuries ago.",
    "This was a Game in the oldest key: the arithmetic of the audible.",
  ],
  "mathematics|philosophy": [
    "This Game moved between proof and question, the two ways the mind refuses to rest.",
  ],
  "music|philosophy": [
    "This Game listened its way toward wisdom, as if harmony itself could argue.",
  ],
  "mathematics|physics": [
    "This Game played where symbol meets substance, where equations put on matter like a garment.",
  ],
  "philosophy|physics": [
    "This Game asked the largest questions in the smallest places, as physics and philosophy always have together.",
  ],
  "music|physics": [
    "This Game tuned itself to the fact that the universe vibrates, and that we can hear some of it.",
  ],
};

const TIER3_CLAUSES = [
  'In "{title}" the Game sounded one of its deepest chords, the kind that goes on ringing after the beads are still.',
  'The finding of "{title}" would have pleased the old Magisters — a synthesis, not a coincidence.',
  '"{title}" was the heart of this Game: two disciplines discovering they had been one all along.',
];

const TIER2_CLAUSES = [
  '"{title}" gave the web its strength — a true correspondence, honestly earned.',
  'With "{title}" the pattern found its keystone.',
  '"{title}" joined what the faculties keep apart.',
];

const TIER1_CLAUSES = [
  '"{title}" added its quiet, solid note.',
  'Smaller strands like "{title}" kept the weave honest.',
];

const MOTIF_CALLOUTS: Record<string, string> = {
  triad: "A triad closed upon itself — theme, counter-theme, and their reconciliation.",
  symposium: "Three disciplines sat at one table; the Game briefly became a symposium.",
  fugue: "Thread followed thread until the web ran like a fugue, voice upon voice.",
};

const FAINT_LINES = [
  "Around the luminous strands, {n} fainter resonances shimmered — reachings that may yet ripen in another Game.",
  "{n} faint threads accompanied them, the way sketches accompany a finished drawing.",
];

const CLOSINGS_QUIET = [
  "A modest Game, and none the worse for it: every Magister began by weaving small.",
  "The web is thin, but it is yours. The beads will keep.",
];

const CLOSINGS_MIDDLE = [
  "A worthy Game. The pattern earns its place in the Archive, and the player earns rest.",
  "The annotators would note balance here, and patience — virtues of the middle rank.",
];

const CLOSINGS_HIGH = [
  "A Game of real distinction. For a while, the unity of knowledge was not an idea but a place you stood in.",
  "The Archive will keep this pattern; the player should keep the feeling of it.",
];

export function composeAnnotation(session: SessionState): string {
  const rng = mulberry32(session.seed ^ 0x9e3779b9);
  const parts: string[] = [];

  // Opening keyed by the two dominant disciplines of the session.
  const key = dominantPairKey(session);
  parts.push(pick(OPENINGS[key] ?? OPENINGS.generic, rng));

  // Clauses for the finest discoveries, best first, at most two.
  const curated = [...session.discoveries]
    .filter((d) => d.kind === "curated")
    .sort((a, b) => b.tier - a.tier || b.points - a.points);
  if (curated.length > 0) {
    parts.push(clauseFor(curated[0].tier, curated[0].title, rng));
  }
  if (curated.length > 1 && curated[1].tier >= 2) {
    parts.push(clauseFor(curated[1].tier, curated[1].title, rng));
  }

  // One motif callout, if any motif was woven.
  if (session.motifs.length > 0) {
    const m = session.motifs[session.motifs.length - 1];
    const callout = MOTIF_CALLOUTS[m.motifId];
    if (callout) parts.push(callout);
  }

  // The faint strands, acknowledged in aggregate.
  const faint = session.discoveries.filter((d) => d.kind === "faint").length;
  if (faint > 0) {
    parts.push(pick(FAINT_LINES, rng).replace("{n}", String(faint)));
  }
  if (curated.length === 0 && faint === 0) {
    parts.push("No threads were woven; the beads kept their silence. Even that is a kind of listening.");
  }

  // Closing by score band.
  const closings =
    session.score >= 81 ? CLOSINGS_HIGH : session.score >= 31 ? CLOSINGS_MIDDLE : CLOSINGS_QUIET;
  parts.push(pick(closings, rng));

  return parts.join(" ");
}

function clauseFor(tier: number, title: string, rng: () => number): string {
  const pool = tier >= 3 ? TIER3_CLAUSES : tier === 2 ? TIER2_CLAUSES : TIER1_CLAUSES;
  return pick(pool, rng).replace("{title}", title);
}

function dominantPairKey(session: SessionState): string {
  const counts = new Map<DisciplineId, number>();
  for (const d of session.discoveries) {
    for (const id of [d.a, d.b]) {
      const disc = conceptById.get(id)?.discipline;
      if (disc) counts.set(disc, (counts.get(disc) ?? 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length < 2) {
    const [a, b] = session.disciplines;
    return [a, b]
      .filter(Boolean)
      .map((d) => disciplineById.get(d)!.id)
      .sort()
      .join("|");
  }
  return [sorted[0][0], sorted[1][0]].sort().join("|");
}
