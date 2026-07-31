import { useEffect, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { useStore as useVanillaStore } from "zustand";
import type { RelationIntention } from "@/domain/events";
import { productionInterpretation } from "@/runtime/interpretation";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";

/**
 * THE INTENTION PLATE
 *
 * Four world-anchored stations engraved on a graduated ring around the
 * attended bead (I-006, I-014). The ring's centre is deliberately empty —
 * the bead itself is there — and the bead's own label steps aside while the
 * plate is open, which is what the previous fan got wrong.
 *
 * The two utility controls sit on the lower diagonals, off the four cardinal
 * stations, so nothing overlaps anything at any viewport size.
 *
 * Every `data-testid`, element id, ARIA role and keyboard behaviour here is
 * part of the accepted interaction contract asserted by
 * `tests/browser/deterministic-mode.spec.ts`. The glyphs are string literals
 * (a previous revision put an escape sequence in JSX text and shipped the
 * literal characters `×` to the screen).
 */

/**
 * Radius of the engraved ring, in CSS pixels. A phone gets a tighter plate so
 * the stations do not cover half the instrument — but the stations themselves
 * keep their 48 px minimum, because a smaller screen does not mean smaller
 * fingers.
 */
const RING_RADIUS_WIDE = 86;
const RING_RADIUS_COMPACT = 62;
const COMPACT_VIEWPORT = 560;

function plateRadius(): number {
  if (typeof window === "undefined") return RING_RADIUS_WIDE;
  return window.innerWidth < COMPACT_VIEWPORT
    ? RING_RADIUS_COMPACT
    : RING_RADIUS_WIDE;
}

interface IntentionOption {
  readonly intention: RelationIntention;
  readonly icon: string;
  readonly label: string;
  readonly description: string;
  /** Station bearing in degrees, measured counter-clockwise from east. */
  readonly bearing: number;
  /** Which side of the station its engraved label sits on. */
  readonly labelPlacement: "above" | "below" | "left" | "right";
}

export const INTENTION_OPTIONS: readonly IntentionOption[] = Object.freeze([
  {
    intention: "echo",
    icon: "◌",
    label: "Echo",
    description: "shares a form",
    bearing: 90,
    labelPlacement: "above",
  },
  {
    intention: "passage",
    icon: "→",
    label: "Passage",
    description: "carries or transforms",
    bearing: 0,
    labelPlacement: "right",
  },
  {
    intention: "tension",
    icon: "≋",
    label: "Tension",
    description: "opposes or complicates",
    bearing: 270,
    labelPlacement: "below",
  },
  {
    intention: "ground",
    icon: "□",
    label: "Ground",
    description: "supports or embodies",
    bearing: 180,
    labelPlacement: "left",
  },
]);

function station(bearing: number, radius: number): React.CSSProperties {
  const radians = (bearing * Math.PI) / 180;
  return {
    left: `calc(50% + ${(Math.cos(radians) * radius).toFixed(2)}px)`,
    top: `calc(50% - ${(Math.sin(radians) * radius).toFixed(2)}px)`,
    transform: "translate(-50%, -50%)",
  };
}

const LABEL_PLACEMENT: Readonly<Record<IntentionOption["labelPlacement"], string>> =
  Object.freeze({
    above: "bottom-full mb-1.5 left-1/2 -translate-x-1/2",
    below: "top-full mt-1.5 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  });

/**
 * The engraved plate behind the stations. Decoration; never a hit target.
 * Strokes come from the world's own palette rather than a utility class, so
 * the ring is guaranteed to read against the arena at any theme.
 */
function Plate({
  armed,
  brass,
  gold,
  radius,
  box,
}: {
  armed: boolean;
  brass: string;
  gold: string;
  radius: number;
  box: number;
}) {
  const graduations = Array.from({ length: 48 }, (_, i) => i);
  const rule = armed ? gold : brass;
  return (
    <svg
      aria-hidden="true"
      viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <circle r={radius} fill="none" stroke={rule} strokeOpacity={0.75} strokeWidth={1} />
      <circle
        r={radius - 8}
        fill="none"
        stroke={rule}
        strokeOpacity={armed ? 0.55 : 0.3}
        strokeWidth={0.6}
      />
      {graduations.map((i) => {
        const angle = (i / graduations.length) * Math.PI * 2;
        const major = i % 12 === 0;
        const outer = radius;
        const inner = radius - (major ? 10 : 4.5);
        return (
          <line
            key={i}
            x1={Math.cos(angle) * inner}
            y1={Math.sin(angle) * inner}
            x2={Math.cos(angle) * outer}
            y2={Math.sin(angle) * outer}
            stroke={rule}
            strokeOpacity={major ? 0.85 : 0.4}
            strokeWidth={major ? 1.4 : 0.7}
          />
        );
      })}
    </svg>
  );
}

/** A temporary world-bound intention plate; it is never a persistent HUD. */
export function IntentionConstellation() {
  const anchor = useRef<THREE.Group>(null);
  const theme = useCurrentTheme();
  const ring = plateRadius();
  const box = ring * 2 + 64;
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const attendedId =
    draft.stage === "inactive" ? null : String(draft.attendedConceptId);

  useFrame(() => {
    if (!anchor.current || draft.stage === "inactive") return;
    const index = frameState.beadIndex.get(String(draft.attendedConceptId));
    if (index === undefined) return;
    const rendered = frameState.rendered;
    anchor.current.position.set(
      rendered[index * 3],
      rendered[index * 3 + 1],
      rendered[index * 3 + 2]
    );
  });

  useEffect(() => {
    if (draft.stage !== "attending" || !attendedId) return;
    if (document.activeElement?.id !== `bead-control-${attendedId}`) return;
    let request = 0;
    let attempts = 0;
    const focusWhenProjected = (): void => {
      const control = document.getElementById("intention-control-echo");
      if (control) {
        control.focus();
        return;
      }
      attempts += 1;
      if (attempts < 60) request = window.requestAnimationFrame(focusWhenProjected);
    };
    request = window.requestAnimationFrame(focusWhenProjected);
    return () => window.cancelAnimationFrame(request);
  }, [attendedId, draft.stage]);

  if (draft.stage === "inactive" || !attendedId) return null;
  const selected = draft.stage === "attending" ? null : draft.intention;
  const selectedOption = INTENTION_OPTIONS.find(
    (option) => option.intention === selected
  );
  const restoreAttendedFocus = (): void => {
    window.requestAnimationFrame(() => {
      document.getElementById(`bead-control-${attendedId}`)?.focus();
    });
  };
  const choose = (intention: RelationIntention, restoreFocus: boolean): void => {
    productionInterpretation.armIntention(intention);
    if (restoreFocus) restoreAttendedFocus();
  };
  const focusIntentionAt = (index: number): void => {
    const bounded =
      (index + INTENTION_OPTIONS.length) % INTENTION_OPTIONS.length;
    document
      .getElementById(
        `intention-control-${INTENTION_OPTIONS[bounded].intention}`
      )
      ?.focus();
  };

  return (
    <group ref={anchor}>
      <Html center style={{ pointerEvents: "none" }} zIndexRange={[18, 12]}>
        <div
          data-testid="intention-constellation"
          className="relative touch-none text-bright"
          style={{ width: box, height: box }}
        >
          <Plate
            armed={selectedOption !== undefined}
            brass={theme.palette.brass}
            gold={theme.palette.gold}
            radius={ring}
            box={box}
          />

          {draft.stage === "attending" ? (
            <div
              role="radiogroup"
              aria-label="Choose an intention for the attended bead"
              className="absolute inset-0"
            >
              {INTENTION_OPTIONS.map((option) => (
                <button
                  key={option.intention}
                  id={`intention-control-${option.intention}`}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  aria-label={`${option.label}: ${option.description}`}
                  data-world-intention={option.intention}
                  data-direct-hover="false"
                  data-testid={`intention-${option.intention}`}
                  style={station(option.bearing, ring)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    const index = INTENTION_OPTIONS.indexOf(option);
                    if (event.key === " ") {
                      event.preventDefault();
                      choose(option.intention, true);
                    } else if (
                      event.key === "ArrowRight" ||
                      event.key === "ArrowDown"
                    ) {
                      event.preventDefault();
                      focusIntentionAt(index + 1);
                    } else if (
                      event.key === "ArrowLeft" ||
                      event.key === "ArrowUp"
                    ) {
                      event.preventDefault();
                      focusIntentionAt(index - 1);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      focusIntentionAt(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      focusIntentionAt(INTENTION_OPTIONS.length - 1);
                    }
                  }}
                  onClick={(event) =>
                    choose(option.intention, event.detail === 0)
                  }
                  className="pointer-events-auto absolute grid min-h-12 min-w-12 place-items-center rounded-full border border-line/80 bg-void/85 text-bright shadow-[0_2px_14px_hsl(var(--void)/0.8)] backdrop-blur-[2px] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow data-[direct-hover=true]:scale-125 data-[direct-hover=true]:border-glow data-[direct-hover=true]:bg-glow/20"
                >
                  <span className="font-display text-xl leading-none" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span
                    className={`pointer-events-none absolute whitespace-nowrap font-ui text-[9px] uppercase tracking-[0.18em] text-dim ${LABEL_PLACEMENT[option.labelPlacement]}`}
                  >
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          ) : selectedOption ? (
            <div
              aria-hidden="true"
              data-testid="armed-intention"
              title={`${selectedOption.label} armed`}
              style={station(selectedOption.bearing, ring)}
              className="pointer-events-none absolute grid h-12 w-12 place-items-center rounded-full border border-glow/80 bg-glow/15 font-display text-2xl text-bright shadow-[0_0_26px_hsl(var(--glow)/0.35)] backdrop-blur-[2px]"
            >
              {selectedOption.icon}
            </div>
          ) : null}

          {/* Utility controls sit on the lower diagonals, clear of all four
              cardinal stations and of the bead at the centre. */}
          <button
            type="button"
            data-testid="world-cancel-interpretation"
            aria-label="Step back from this interpretation"
            style={station(225, ring + 4)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => productionInterpretation.cancel()}
            className="pointer-events-auto absolute grid h-11 w-11 place-items-center rounded-full border border-line/50 bg-void/70 font-ui text-base leading-none text-dim/85 backdrop-blur-[2px] transition-colors hover:border-line hover:text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
          >
            <span aria-hidden="true">×</span>
          </button>
          <button
            type="button"
            data-testid="world-inspect-attended"
            aria-label="Details for the attended bead"
            style={station(315, ring + 4)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              productionInterpretation.inspect(draft.attendedConceptId)
            }
            className="pointer-events-auto absolute grid h-11 w-11 place-items-center rounded-full border border-line/50 bg-void/70 font-display text-base italic leading-none text-dim/85 backdrop-blur-[2px] transition-colors hover:border-line hover:text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
          >
            <span aria-hidden="true">i</span>
          </button>
        </div>
      </Html>
    </group>
  );
}
