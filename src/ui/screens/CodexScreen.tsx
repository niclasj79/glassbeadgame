import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/state/store";
import { connections } from "@/content/connections";
import { conceptById } from "@/content/concepts";
import { disciplineById, disciplines } from "@/content/disciplines";
import { totalConnections } from "@/game/ranks";
import type { SessionMemory } from "@/state/types";
import type { CuratedConnection, DisciplineId } from "@/content/types";
import { RankSigil } from "../components/RankSigil";
import { CodexAtlas } from "./CodexAtlas";
import { SessionReplay } from "./SessionReplay";

function groupKey(c: CuratedConnection): string {
  const da = conceptById.get(c.pair[0])!.discipline;
  const db = conceptById.get(c.pair[1])!.discipline;
  return [da, db].sort().join("|");
}

function GroupHeader({ keyStr }: { keyStr: string }) {
  const [a, b] = keyStr.split("|") as [DisciplineId, DisciplineId];
  const da = disciplineById.get(a)!;
  const db = disciplineById.get(b)!;
  const same = a === b;
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-display text-xl" style={{ color: da.color }}>
        {da.glyph}
      </span>
      {!same && (
        <>
          <span className="text-line">×</span>
          <span className="font-display text-xl" style={{ color: db.color }}>
            {db.glyph}
          </span>
        </>
      )}
      <span className="font-ui text-[11px] uppercase tracking-[0.3em] text-dim">
        {same ? `Within ${da.name}` : `${da.name} × ${db.name}`}
      </span>
    </div>
  );
}

function Entry({ conn, found }: { conn: CuratedConnection; found: boolean }) {
  const a = conceptById.get(conn.pair[0])!;
  const b = conceptById.get(conn.pair[1])!;
  if (!found) {
    return (
      <li className="rounded-2xl border border-line/25 bg-surface/30 p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-base italic text-dim/50">— undiscovered —</p>
          <span className="text-dim/40">{"✦".repeat(conn.tier)}</span>
        </div>
        <p className="mt-1 font-ui text-[11px] text-dim/45">
          {a.name} <span className="text-line">×</span> {b.name}
        </p>
      </li>
    );
  }
  return (
    <li className="rounded-2xl border border-line/50 bg-elevated/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-display text-base font-medium text-bright">{conn.title}</h4>
        <span className="shrink-0 text-resonance">{"✦".repeat(conn.tier)}</span>
      </div>
      <p className="mt-1 font-ui text-[11px] text-dim">
        {a.name} <span className="text-line">×</span> {b.name}
      </p>
      <p className="mt-2 font-ui text-[13px] leading-relaxed text-dim">{conn.insight}</p>
      {conn.quote && (
        <p className="mt-2 border-l border-glow/40 pl-3 font-display text-xs italic text-dim/80">
          “{conn.quote.text}” <span className="not-italic text-dim/60">— {conn.quote.source}</span>
        </p>
      )}
    </li>
  );
}

/** The permanent collection — every curated connection ever discovered. */
export function CodexScreen() {
  const open = useStore((s) => s.codexOpen);
  const setCodexOpen = useStore((s) => s.setCodexOpen);
  const codex = useStore((s) => s.codex);
  const archive = useStore((s) => s.sessionArchive);
  const [replay, setReplay] = useState<SessionMemory | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, CuratedConnection[]>();
    for (const c of connections) {
      const k = groupKey(c);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    // Discipline-pair order follows the canonical discipline order.
    const order = disciplines.map((d) => d.id);
    return [...map.entries()].sort((x, y) => {
      const [xa, xb] = x[0].split("|");
      const [ya, yb] = y[0].split("|");
      return (
        order.indexOf(xa as DisciplineId) - order.indexOf(ya as DisciplineId) ||
        order.indexOf(xb as DisciplineId) - order.indexOf(yb as DisciplineId)
      );
    });
  }, []);

  const found = Object.keys(codex).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-20 overflow-y-auto bg-void/88 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mx-auto w-full max-w-3xl px-6 py-14">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="font-ui text-[11px] uppercase tracking-[0.55em] text-dim/80">
                  The Archive
                </p>
                <h2 className="mt-2 font-display text-5xl font-medium text-bright">Codex</h2>
                <p className="mt-2 font-ui text-sm text-dim">
                  {found} of {totalConnections()} connections discovered
                </p>
              </div>
              <RankSigil codexCount={found} totalCount={totalConnections()} size={92} />
            </div>

            <CodexAtlas codex={codex} archive={archive} onReplay={setReplay} />

            <div className="mt-12 space-y-10">
              {groups.map(([key, conns]) => (
                <section key={key}>
                  <GroupHeader keyStr={key} />
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {conns.map((c) => (
                      <Entry key={c.id} conn={c} found={!!codex[c.id]} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="mt-12 flex justify-center">
              <button
                onClick={() => setCodexOpen(false)}
                className="rounded-full border border-line/60 px-8 py-3 font-ui text-[11px] uppercase tracking-[0.28em] text-bright transition-colors hover:border-glow/60 hover:bg-glow/10"
              >
                Close
              </button>
            </div>
          </div>
          <SessionReplay memory={replay} onClose={() => setReplay(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
