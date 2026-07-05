import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { conceptById } from "@/content/concepts";
import { useStore } from "@/state/store";
import type { MotifAward, SessionState } from "@/state/types";
import { GlassPanel } from "../components/GlassPanel";

interface MotifProgress {
  id: MotifAward["motifId"];
  name: string;
  progress: number;
  max: number;
  complete: boolean;
  hint: string;
}

const MOTIF_HINTS: Record<MotifAward["motifId"], string> = {
  triad: "Close a triangle",
  symposium: "Join three disciplines",
  fugue: "Weave a chain of five",
};

function adjacency(session: SessionState): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const t of session.threads) {
    if (!adj.has(t.a)) adj.set(t.a, new Set());
    if (!adj.has(t.b)) adj.set(t.b, new Set());
    adj.get(t.a)!.add(t.b);
    adj.get(t.b)!.add(t.a);
  }
  return adj;
}

function hasMotif(session: SessionState, id: MotifAward["motifId"]): boolean {
  return session.motifs.some((m) => m.motifId === id);
}

function triadProgress(session: SessionState, adj: Map<string, Set<string>>): number {
  if (hasMotif(session, "triad")) return 3;
  if (session.threads.length === 0) return 0;
  for (const neighbors of adj.values()) {
    if (neighbors.size >= 2) return 2;
  }
  return 1;
}

function symposiumProgress(session: SessionState, adj: Map<string, Set<string>>): number {
  if (hasMotif(session, "symposium")) return 3;
  let best = 0;
  const seen = new Set<string>();
  for (const id of session.beadIds) {
    if (seen.has(id)) continue;
    const component = new Set<string>();
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      component.add(cur);
      for (const nxt of adj.get(cur) ?? []) {
        if (!seen.has(nxt)) {
          seen.add(nxt);
          stack.push(nxt);
        }
      }
    }
    const disciplines = new Set(
      [...component].map((node) => conceptById.get(node)?.discipline).filter(Boolean)
    );
    best = Math.max(best, disciplines.size);
  }
  return Math.min(3, best);
}

function longestPath(session: SessionState, adj: Map<string, Set<string>>): number {
  if (session.threads.length === 0) return 0;
  let best = 1;
  const dfs = (node: string, visited: Set<string>, len: number) => {
    best = Math.max(best, len);
    if (len >= 5) return;
    for (const nxt of adj.get(node) ?? []) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        dfs(nxt, visited, len + 1);
        visited.delete(nxt);
      }
    }
  };
  for (const id of session.beadIds) {
    dfs(id, new Set([id]), 1);
  }
  return Math.min(5, best);
}

function motifProgress(session: SessionState): MotifProgress[] {
  const adj = adjacency(session);
  return [
    {
      id: "triad",
      name: "Triad",
      progress: triadProgress(session, adj),
      max: 3,
      complete: hasMotif(session, "triad"),
      hint: MOTIF_HINTS.triad,
    },
    {
      id: "symposium",
      name: "Symposium",
      progress: symposiumProgress(session, adj),
      max: 3,
      complete: hasMotif(session, "symposium"),
      hint: MOTIF_HINTS.symposium,
    },
    {
      id: "fugue",
      name: "Fugue",
      progress: hasMotif(session, "fugue") ? 5 : longestPath(session, adj),
      max: 5,
      complete: hasMotif(session, "fugue"),
      hint: MOTIF_HINTS.fugue,
    },
  ];
}

function Pips({ progress, max, complete }: { progress: number; max: number; complete: boolean }) {
  return (
    <span className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={clsx(
            "h-1.5 w-1.5 rounded-full transition-colors",
            i < progress
              ? complete
                ? "bg-resonance shadow-[0_0_8px_hsl(var(--resonance)/0.8)]"
                : "bg-glow/80"
              : "bg-line/60"
          )}
        />
      ))}
    </span>
  );
}

const COLLAPSE_KEY = "gbg.motifsCollapsed";

export function MotifTracker() {
  const session = useStore((s) => s.session);
  const mode = useStore((s) => s.session?.interaction.mode ?? "idle");
  const items = useMemo(() => (session ? motifProgress(session) : []), [session]);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      return !v;
    });
  };

  if (!session || session.threads.length === 0 || mode === "concluding") return null;

  // Minimized: a quiet pill that remembers its place.
  if (collapsed) {
    return (
      <button
        onClick={toggle}
        aria-expanded={false}
        aria-label="Expand motifs"
        className="pointer-events-auto absolute left-5 top-[4.6rem] hidden items-center gap-2 rounded-full border border-line/40 bg-void/62 px-4 py-2 font-ui text-[10px] uppercase tracking-[0.3em] text-dim backdrop-blur-md transition-colors hover:border-line/80 hover:text-bright md:flex"
      >
        Motifs {session.motifs.length}/3
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
          <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
    );
  }

  return (
    <GlassPanel className="pointer-events-auto absolute left-5 top-[4.6rem] hidden w-72 bg-void/62 p-3.5 md:block">
      <div className="flex items-center justify-between">
        <p className="font-ui text-[10px] uppercase tracking-[0.34em] text-dim">Motifs</p>
        <span className="flex items-center gap-2.5">
          <p className="font-ui text-[10px] tabular-nums text-dim/70">
            {session.motifs.length}/3
          </p>
          <button
            onClick={toggle}
            aria-expanded
            aria-label="Minimize motifs"
            className="grid h-5 w-5 place-items-center rounded-full border border-line/40 text-dim transition-colors hover:border-line/80 hover:text-bright"
          >
            <svg width="8" height="2" viewBox="0 0 8 2" fill="none" aria-hidden>
              <path d="M0 1h8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[5.7rem_1fr] items-center gap-3">
            <div>
              <p
                className={clsx(
                  "font-display text-sm leading-none",
                  item.complete ? "text-resonance" : "text-bright/90"
                )}
              >
                {item.name}
              </p>
              <p className="mt-0.5 font-ui text-[9px] uppercase tracking-[0.14em] text-dim/55">
                {item.hint}
              </p>
            </div>
            <Pips progress={item.progress} max={item.max} complete={item.complete} />
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function MotifDiagram({ id }: { id: MotifAward["motifId"] }) {
  if (id === "triad") {
    return (
      <svg viewBox="0 0 80 56" className="h-14 w-20 text-resonance" aria-hidden>
        <path d="M40 6 70 50H10L40 6Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="40" cy="6" r="4" fill="currentColor" />
        <circle cx="70" cy="50" r="4" fill="currentColor" />
        <circle cx="10" cy="50" r="4" fill="currentColor" />
      </svg>
    );
  }
  if (id === "fugue") {
    return (
      <svg viewBox="0 0 96 44" className="h-12 w-24 text-resonance" aria-hidden>
        <path d="M8 28 C26 4 36 44 52 20 S78 10 88 28" fill="none" stroke="currentColor" strokeWidth="2" />
        {[8, 28, 48, 68, 88].map((x, i) => (
          <circle key={x} cx={x} cy={i % 2 ? 18 : 28} r="3.5" fill="currentColor" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 52" className="h-12 w-20 text-resonance" aria-hidden>
      <circle cx="18" cy="26" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="40" cy="18" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="62" cy="26" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function MotifRitualToast({ motif }: { motif: MotifAward }) {
  // NOTE: framer-motion owns `transform`, so Tailwind -translate-x-1/2 dies
  // the moment y/scale animate. A plain flex wrapper does the centering.
  return (
    <div className="pointer-events-none absolute inset-x-4 top-6 flex justify-center">
    <motion.div
      className="w-[min(430px,100%)]"
      initial={{ opacity: 0, y: -14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassPanel className="bg-resonance/10 px-5 py-4 shadow-[0_0_48px_-14px_hsl(var(--resonance)/0.9)]">
        <div className="flex items-center gap-4">
          <MotifDiagram id={motif.motifId} />
          <div className="min-w-0">
            <p className="font-ui text-[10px] uppercase tracking-[0.35em] text-resonance">
              Motif completed
            </p>
            <h3 className="mt-1 font-display text-2xl font-medium text-bright">
              {motif.name}
            </h3>
            <p className="mt-0.5 font-ui text-[12px] text-dim">
              +{motif.points} resonance
            </p>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
    </div>
  );
}
