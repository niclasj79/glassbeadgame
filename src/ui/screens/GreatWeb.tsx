import { useMemo, useRef, useState } from "react";
import { connections } from "@/content/connections";
import { concepts } from "@/content/concepts";
import { disciplines, disciplineById } from "@/content/disciplines";
import { computeMilestones } from "@/game/progress";
import type { CodexEntry } from "@/state/types";

/**
 * The Great Web — all ninety concepts as one constellation, six faculties
 * around a common center, every discovered connection a luminous edge.
 * It fills in across weeks of play; undiscovered edges simply do not exist
 * yet. Wheel to zoom, drag to wander.
 */

const W = 720;
const H = 600;
const CX = W / 2;
const CY = H / 2;
const SECTOR_R = 190;
const SPREAD = 80;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function nodePositions(): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  disciplines.forEach((disc, di) => {
    const angle = (di / disciplines.length) * Math.PI * 2 - Math.PI / 2;
    const cx = CX + Math.cos(angle) * SECTOR_R;
    const cy = CY + Math.sin(angle) * SECTOR_R;
    const own = concepts.filter((c) => c.discipline === disc.id);
    own.forEach((c, i) => {
      const r = SPREAD * Math.sqrt((i + 0.5) / own.length);
      const th = GOLDEN * i + angle; // spiral oriented outward from center
      pos.set(c.id, { x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r });
    });
  });
  return pos;
}

interface Props {
  codex: Record<string, CodexEntry>;
}

export function GreatWeb({ codex }: Props) {
  const positions = useMemo(nodePositions, []);
  const milestones = useMemo(() => computeMilestones(codex), [codex]);
  const found = useMemo(() => connections.filter((c) => codex[c.id]), [codex]);
  const touched = useMemo(() => {
    const s = new Set<string>();
    for (const c of found) {
      s.add(c.pair[0]);
      s.add(c.pair[1]);
    }
    return s;
  }, [found]);

  // Wheel-zoom + drag-pan via viewBox.
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const vw = W / view.k;
  const vh = H / view.k;
  const vx = view.x + (W - vw) / 2;
  const vy = view.y + (H - vh) / 2;

  const facultyNames = milestones.facultiesComplete
    .map((d) => disciplineById.get(d)?.name)
    .filter(Boolean);

  return (
    <div>
      <svg
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        className="mt-4 w-full cursor-grab touch-none rounded-2xl border border-line/40 bg-void/50 active:cursor-grabbing"
        style={{ aspectRatio: `${W}/${H}` }}
        onWheel={(e) => {
          const k = Math.max(0.8, Math.min(3.2, view.k * (e.deltaY < 0 ? 1.15 : 0.87)));
          setView((v) => ({ ...v, k }));
        }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const scale = vw / (e.currentTarget.clientWidth || W);
          setView((v) => ({
            ...v,
            x: drag.current!.vx - (e.clientX - drag.current!.x) * scale,
            y: drag.current!.vy - (e.clientY - drag.current!.y) * scale,
          }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        {/* Discovered edges — the web that exists so far. */}
        {found.map((c) => {
          const a = positions.get(c.pair[0]);
          const b = positions.get(c.pair[1]);
          if (!a || !b) return null;
          return (
            <line
              key={c.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="hsl(42 92% 60%)"
              strokeWidth={0.4 + c.tier * 0.45}
              strokeOpacity={0.2 + c.tier * 0.14}
            >
              <title>{c.title}</title>
            </line>
          );
        })}

        {/* All ninety concepts — the beads awaiting their threads. */}
        {concepts.map((c) => {
          const p = positions.get(c.id)!;
          const disc = disciplineById.get(c.discipline)!;
          const lit = touched.has(c.id);
          return (
            <circle
              key={c.id}
              cx={p.x}
              cy={p.y}
              r={lit ? 3.4 : 1.9}
              fill={lit ? disc.color : "hsl(248 24% 30%)"}
              fillOpacity={lit ? 0.95 : 0.55}
            >
              <title>{c.name}</title>
            </circle>
          );
        })}

        {/* Faculty sigils */}
        {disciplines.map((disc, di) => {
          const angle = (di / disciplines.length) * Math.PI * 2 - Math.PI / 2;
          const x = CX + Math.cos(angle) * (SECTOR_R + SPREAD + 26);
          const y = CY + Math.sin(angle) * (SECTOR_R + SPREAD + 26);
          const complete = milestones.facultiesComplete.includes(disc.id);
          return (
            <text
              key={disc.id}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="17"
              fill={disc.color}
              fillOpacity={complete ? 1 : 0.55}
            >
              {disc.glyph}
              <title>
                {disc.name}
                {complete ? " — faculty complete" : ""}
              </title>
            </text>
          );
        })}
      </svg>

      {/* Milestones of the Great Web */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip
          earned={milestones.firstTriad}
          label="The First Triad"
          hint="Close a triangle across three disciplines"
        />
        <Chip
          earned={facultyNames.length > 0}
          label={
            facultyNames.length > 0
              ? `Faculty complete: ${facultyNames.join(", ")}`
              : "Faculty Complete"
          }
          hint="Discover every connection touching one discipline"
        />
        <Chip
          earned={milestones.theHundred}
          label="The Hundred"
          hint="One hundred connections in the Codex"
        />
      </div>
    </div>
  );
}

function Chip({ earned, label, hint }: { earned: boolean; label: string; hint: string }) {
  return (
    <span
      title={hint}
      className={
        "rounded-full border px-4 py-1.5 font-ui text-[10px] uppercase tracking-[0.2em] " +
        (earned
          ? "border-resonance/50 bg-resonance/10 text-resonance"
          : "border-line/30 bg-surface/30 text-dim/50")
      }
    >
      {earned ? "✦ " : ""}
      {label}
    </span>
  );
}
