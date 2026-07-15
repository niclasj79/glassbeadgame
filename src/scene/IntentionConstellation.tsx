import { useEffect, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { useStore as useVanillaStore } from "zustand";
import type { RelationIntention } from "@/domain/events";
import { productionInterpretation } from "@/runtime/interpretation";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { frameState } from "./frameState";

export const INTENTION_OPTIONS: readonly {
  readonly intention: RelationIntention;
  readonly icon: string;
  readonly label: string;
  readonly description: string;
  readonly className: string;
}[] = Object.freeze([
  { intention: "echo", icon: "\u25cc", label: "Echo", description: "shares a form", className: "left-1/2 top-0 -translate-x-1/2" },
  { intention: "passage", icon: "\u2192", label: "Passage", description: "carries or transforms", className: "right-0 top-1/2 -translate-y-1/2" },
  { intention: "tension", icon: "\u224b", label: "Tension", description: "opposes or complicates", className: "bottom-0 left-1/2 -translate-x-1/2" },
  { intention: "ground", icon: "\u25a1", label: "Ground", description: "supports or embodies", className: "left-0 top-1/2 -translate-y-1/2" },
]);

/** A temporary world-bound intention fan; it is never a persistent HUD. */
export function IntentionConstellation() {
  const anchor = useRef<THREE.Group>(null);
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
          className="relative h-48 w-48 touch-none"
        >
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
                  className={`pointer-events-auto absolute grid min-h-12 min-w-12 place-items-center rounded-full border border-line/70 bg-void/75 px-2 text-bright shadow-[0_0_22px_hsl(var(--glow)/0.22)] backdrop-blur-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow data-[direct-hover=true]:scale-125 data-[direct-hover=true]:border-glow data-[direct-hover=true]:bg-glow/20 ${option.className}`}
                >
                  <span className="font-display text-xl leading-none" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className="absolute top-full mt-1 whitespace-nowrap font-ui text-[9px] uppercase tracking-[0.16em] text-dim">
                    {option.label}
                  </span>
                </button>
              ))}
              <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-ui text-[9px] uppercase tracking-[0.18em] text-dim/75">
                load intention
              </span>
            </div>
          ) : selectedOption ? (
            <div
              aria-hidden="true"
              data-testid="armed-intention"
              title={`${selectedOption.label} armed`}
              className="pointer-events-none absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-glow/70 bg-glow/15 font-display text-2xl text-bright shadow-[0_0_28px_hsl(var(--glow)/0.35)] backdrop-blur-[2px]"
            >
              {selectedOption.icon}
            </div>
          ) : null}

          <button
            type="button"
            data-testid="world-cancel-interpretation"
            aria-label="Step back from this interpretation"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => productionInterpretation.cancel()}
            className="pointer-events-auto absolute left-[33%] top-[70%] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line/45 bg-void/55 font-ui text-sm text-dim/80 backdrop-blur-sm transition-colors hover:border-line hover:text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
          >
            <span aria-hidden="true">\u00d7</span>
          </button>
          <button
            type="button"
            data-testid="world-inspect-attended"
            aria-label="Details for the attended bead"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              productionInterpretation.inspect(draft.attendedConceptId)
            }
            className="pointer-events-auto absolute left-[67%] top-[70%] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line/45 bg-void/55 font-display text-base italic text-dim/80 backdrop-blur-sm transition-colors hover:border-line hover:text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
          >
            <span aria-hidden="true">i</span>
          </button>
        </div>
      </Html>
    </group>
  );
}
