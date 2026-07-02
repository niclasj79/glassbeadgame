import { useMemo, useState } from "react";
import { connections } from "@/content/connections";
import { concepts, conceptById } from "@/content/concepts";
import { disciplineById, disciplines } from "@/content/disciplines";
import type { CuratedConnection, DisciplineId } from "@/content/types";
import { TIER_POINTS } from "@/game/rules";
import type { CodexEntry, Discovery, SessionMemory } from "@/state/types";
import { GlassPanel } from "../components/GlassPanel";
import { Button } from "../components/Button";

const WIDTH = 720;
const HEIGHT = 420;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const DISC_RADIUS = 145;
const NODE_RADIUS = 34;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

interface Point {
  x: number;
  y: number;
}

interface Props {
  codex: Record<string, CodexEntry>;
  archive: SessionMemory[];
  onReplay: (memory: SessionMemory) => void;
}

function atlasPositions(): Map<string, Point> {
  const out = new Map<string, Point>();
  disciplines.forEach((discipline, discIndex) => {
    const angle = -Math.PI / 2 + (discIndex / disciplines.length) * Math.PI * 2;
    const anchor = {
      x: CENTER_X + Math.cos(angle) * DISC_RADIUS,
      y: CENTER_Y + Math.sin(angle) * DISC_RADIUS,
    };
    const list = concepts.filter((c) => c.discipline === discipline.id);
    list.forEach((concept, i) => {
      const nodeAngle = i * GOLDEN;
      const nodeRadius = 8 + Math.sqrt(i + 1) * 5.4;
      out.set(concept.id, {
        x: anchor.x + Math.cos(nodeAngle) * Math.min(NODE_RADIUS, nodeRadius),
        y: anchor.y + Math.sin(nodeAngle) * Math.min(NODE_RADIUS, nodeRadius),
      });
    });
  });
  return out;
}

const POSITIONS = atlasPositions();

function groupPoint(id: DisciplineId): Point {
  const index = disciplines.findIndex((d) => d.id === id);
  const angle = -Math.PI / 2 + (index / disciplines.length) * Math.PI * 2;
  return {
    x: CENTER_X + Math.cos(angle) * DISC_RADIUS,
    y: CENTER_Y + Math.sin(angle) * DISC_RADIUS,
  };
}

function pairLabel(conn: CuratedConnection): string {
  const a = conceptById.get(conn.pair[0]);
  const b = conceptById.get(conn.pair[1]);
  return `${a?.name ?? "Unknown"} x ${b?.name ?? "Unknown"}`;
}

function memoryFromConnection(conn: CuratedConnection): SessionMemory {
  const discovery: Discovery = {
    id: conn.id,
    a: conn.pair[0],
    b: conn.pair[1],
    kind: "curated",
    tier: conn.tier,
    title: conn.title,
    insight: conn.insight,
    quote: conn.quote,
    newToCodex: false,
    points: TIER_POINTS[conn.tier],
  };
  return {
    id: `codex-${conn.id}`,
    seed: 0,
    endedAt: Date.now(),
    disciplines: [
      conceptById.get(conn.pair[0])!.discipline,
      conceptById.get(conn.pair[1])!.discipline,
    ],
    beadIds: conn.pair,
    threads: [
      {
        id: conn.id,
        a: conn.pair[0],
        b: conn.pair[1],
        kind: "curated",
        tier: conn.tier,
        createdAt: Date.now(),
      },
    ],
    discoveries: [discovery],
    motifs: [],
    score: discovery.points,
  };
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function SessionArchiveList({ archive, onReplay }: Pick<Props, "archive" | "onReplay">) {
  if (archive.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-ui text-[10px] uppercase tracking-[0.4em] text-dim/80">
            Performances
          </p>
          <h3 className="mt-1 font-display text-2xl font-medium text-bright">
            Recent discovery chains
          </h3>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {archive.slice(0, 6).map((memory) => {
          const curated = memory.discoveries.filter((d) => d.kind === "curated").length;
          return (
            <div key={memory.id} className="rounded-2xl border border-line/40 bg-surface/45 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-ui text-[10px] uppercase tracking-[0.22em] text-dim/65">
                    {formatDate(memory.endedAt)}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {memory.disciplines.map((id) => {
                      const d = disciplineById.get(id);
                      return d ? (
                        <span key={id} className="font-display text-xl" style={{ color: d.color }}>
                          {d.glyph}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
                <p className="font-ui text-xs font-semibold tabular-nums text-resonance">
                  {memory.score}
                </p>
              </div>
              <p className="mt-3 font-ui text-[12px] leading-relaxed text-dim">
                {memory.discoveries.length} discoveries, {curated} luminous, {memory.motifs.length} motifs
              </p>
              <Button className="mt-4 px-5 py-2.5" onClick={() => onReplay(memory)}>
                Replay chain
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CodexAtlas({ codex, archive, onReplay }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const foundCount = Object.keys(codex).length;
  const selected = selectedId ? connections.find((c) => c.id === selectedId) : null;

  const foundConcepts = useMemo(() => {
    const ids = new Set<string>();
    for (const conn of connections) {
      if (!codex[conn.id]) continue;
      ids.add(conn.pair[0]);
      ids.add(conn.pair[1]);
    }
    return ids;
  }, [codex]);

  const orderedConnections = useMemo(
    () => [...connections].sort((a, b) => Number(!!codex[a.id]) - Number(!!codex[b.id])),
    [codex]
  );

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-ui text-[10px] uppercase tracking-[0.4em] text-dim/80">
            The Atlas
          </p>
          <h3 className="mt-1 font-display text-3xl font-medium text-bright">
            A map of the Archive
          </h3>
        </div>
        <p className="font-ui text-[11px] uppercase tracking-[0.24em] text-dim/70">
          {foundCount} luminous routes charted
        </p>
      </div>

      <GlassPanel className="mt-4 overflow-hidden bg-void/65 p-3">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Codex atlas">
          <defs>
            <radialGradient id="atlas-core" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="hsl(var(--glow) / 0.22)" />
              <stop offset="100%" stopColor="hsl(var(--glow) / 0)" />
            </radialGradient>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#atlas-core)" />
          {orderedConnections.map((conn) => {
            const a = POSITIONS.get(conn.pair[0]);
            const b = POSITIONS.get(conn.pair[1]);
            if (!a || !b) return null;
            const found = !!codex[conn.id];
            const active = selectedId === conn.id;
            return (
              <line
                key={conn.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={found ? "hsl(var(--resonance))" : "hsl(var(--line))"}
                strokeOpacity={active ? 0.95 : found ? 0.48 : 0.14}
                strokeWidth={active ? 2.6 : found ? 1.4 : 0.8}
                onMouseEnter={() => setSelectedId(conn.id)}
                onFocus={() => setSelectedId(conn.id)}
                onClick={() => setSelectedId(conn.id)}
                className="cursor-pointer transition-opacity"
              />
            );
          })}
          {orderedConnections.map((conn) => {
            const a = POSITIONS.get(conn.pair[0]);
            const b = POSITIONS.get(conn.pair[1]);
            if (!a || !b) return null;
            return (
              <line
                key={`${conn.id}-hit`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth="14"
                pointerEvents="stroke"
                onMouseEnter={() => setSelectedId(conn.id)}
                onFocus={() => setSelectedId(conn.id)}
                onClick={() => setSelectedId(conn.id)}
                className="cursor-pointer"
              />
            );
          })}
          {disciplines.map((discipline) => {
            const p = groupPoint(discipline.id);
            return (
              <g key={discipline.id}>
                <circle cx={p.x} cy={p.y} r="42" fill="none" stroke={discipline.color} strokeOpacity="0.12" />
                <text
                  x={p.x}
                  y={p.y - 50}
                  textAnchor="middle"
                  fill="hsl(var(--dim))"
                  fontSize="10"
                  letterSpacing="4"
                  className="font-ui uppercase"
                >
                  {discipline.name}
                </text>
              </g>
            );
          })}
          {concepts.map((concept) => {
            const p = POSITIONS.get(concept.id);
            const discipline = disciplineById.get(concept.discipline);
            if (!p || !discipline) return null;
            const found = foundConcepts.has(concept.id);
            return (
              <circle
                key={concept.id}
                cx={p.x}
                cy={p.y}
                r={found ? 3.6 : 2.3}
                fill={found ? discipline.color : "hsl(var(--line))"}
                opacity={found ? 0.95 : 0.42}
                pointerEvents="none"
              >
                <title>{concept.name}</title>
              </circle>
            );
          })}
        </svg>

        <div className="border-t border-line/35 px-2 py-4">
          {selected ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-ui text-[10px] uppercase tracking-[0.28em] text-dim/70">
                  {codex[selected.id] ? "Discovered route" : "Uncharted route"}
                </p>
                <h4 className="mt-1 font-display text-xl font-medium text-bright">
                  {codex[selected.id] ? selected.title : "Undiscovered"}
                </h4>
                <p className="mt-1 font-ui text-[12px] text-dim">{pairLabel(selected)}</p>
              </div>
              {codex[selected.id] && (
                <Button className="px-5 py-2.5" onClick={() => onReplay(memoryFromConnection(selected))}>
                  Replay discovery
                </Button>
              )}
            </div>
          ) : (
            <p className="font-display text-base italic text-dim">
              Hover a route to inspect it. Bright routes are already in your Codex.
            </p>
          )}
        </div>
      </GlassPanel>

      <SessionArchiveList archive={archive} onReplay={onReplay} />
    </section>
  );
}
