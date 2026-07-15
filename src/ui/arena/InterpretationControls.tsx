import { useEffect, useRef } from "react";
import { useStore as useVanillaStore } from "zustand";
import { conceptById } from "@/content/concepts";
import type { InputModality, RelationIntention } from "@/domain/events";
import { toConceptId } from "@/domain/ids";
import { productionInterpretation } from "@/runtime/interpretation";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { interpretationPresentationStore } from "@/state/interpretationPresentation";
import { useStore } from "@/state/store";
import { GlassPanel } from "../components/GlassPanel";

const INTENTIONS: readonly {
  intention: RelationIntention;
  icon: string;
  label: string;
  description: string;
}[] = [
  { intention: "echo", icon: "◌", label: "Echo", description: "shares a form" },
  { intention: "passage", icon: "→", label: "Passage", description: "carries or transforms" },
  { intention: "tension", icon: "≋", label: "Tension", description: "opposes or complicates" },
  { intention: "ground", icon: "□", label: "Ground", description: "supports or embodies" },
];

function modality(pointerType: string): InputModality {
  if (pointerType === "touch") return "touch";
  if (pointerType === "pen") return "pen";
  return "mouse";
}

function point(event: { clientX: number; clientY: number; pressure?: number }) {
  return {
    xViewport: event.clientX / window.innerWidth,
    yViewport: event.clientY / window.innerHeight,
    ...(event.pressure === undefined ? {} : { pressure: event.pressure }),
  };
}

export function InterpretationControls() {
  const beadIds = useStore((state) => state.session?.beadIds ?? []);
  const focusedBeadId = useStore((state) => state.focusedBeadId);
  const setFocusedBead = useStore((state) => state.setFocusedBead);
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const presentation = useVanillaStore(
    interpretationPresentationStore,
    (state) => state
  );
  const pointerId = useRef<number | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const cancelCapture = () => {
      pointerId.current = null;
      productionInterpretation.cancelWeave();
    };
    window.addEventListener("blur", cancelCapture);
    return () => {
      window.removeEventListener("blur", cancelCapture);
      cancelCapture();
    };
  }, []);

  const activate = (id: string) => {
    productionInterpretation.activateConcept(toConceptId(id));
    setFocusedBead(id);
  };
  const selectedIntention =
    draft.stage === "armed" || draft.stage === "candidate-selected"
      ? draft.intention
      : null;
  const candidateId =
    draft.stage === "candidate-selected" ? draft.candidateConceptId : null;
  const attendedId = draft.stage === "inactive" ? null : draft.attendedConceptId;

  return (
    <GlassPanel className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(94vw,760px)] -translate-x-1/2 bg-void/80 p-3">
      <div className="flex gap-1 overflow-x-auto pb-2" role="group" aria-label="Beads in this draw">
        {beadIds.map((id) => {
          const concept = conceptById.get(id);
          const selected = id === attendedId || id === candidateId;
          const band = presentation.candidateResonance.find(
            (candidate) => String(candidate.candidateId) === id
          )?.band;
          return (
            <button
              key={id}
              type="button"
              data-testid={`bead-control-${id}`}
              aria-pressed={selected}
              aria-label={`${concept?.name ?? id}${band ? `, ${band} resonance` : ""}`}
              title={concept?.name ?? id}
              onFocus={() => setFocusedBead(id)}
              onClick={() => activate(id)}
              className={`min-h-10 shrink-0 rounded-full border px-3 py-1 font-ui text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow ${
                selected
                  ? "border-resonance bg-resonance/20 text-bright"
                  : id === focusedBeadId
                    ? "border-line text-bright"
                    : "border-line/40 text-dim"
              }`}
            >
              {concept?.name ?? id}
              {band && <span className="sr-only">, {band} resonance</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <div role="radiogroup" aria-label="Intention" className="flex flex-wrap justify-center gap-1">
          {INTENTIONS.map(({ intention, icon, label, description }) => (
            <button
              key={intention}
              type="button"
              role="radio"
              aria-checked={selectedIntention === intention}
              disabled={draft.stage === "inactive"}
              onClick={() => productionInterpretation.armIntention(intention)}
              className={`min-h-10 rounded-full border px-3 py-1.5 font-ui text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow disabled:opacity-35 ${
                selectedIntention === intention
                  ? "border-glow bg-glow/15 text-bright"
                  : "border-line/40 text-dim"
              }`}
            >
              <span aria-hidden="true">{icon} </span>{label}
              <span className="hidden text-dim md:inline"> · {description}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          data-testid="weave-control"
          disabled={draft.stage !== "candidate-selected"}
          onPointerDown={(event) => {
            if (draft.stage !== "candidate-selected") return;
            pointerId.current = event.pointerId;
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            productionInterpretation.beginWeave(modality(event.pointerType), point(event));
          }}
          onPointerMove={(event) => {
            if (pointerId.current === event.pointerId) productionInterpretation.updateWeave(point(event));
          }}
          onPointerUp={(event) => {
            if (pointerId.current !== event.pointerId) return;
            pointerId.current = null;
            productionInterpretation.commitWeave(point(event));
          }}
          onPointerCancel={() => {
            pointerId.current = null;
            productionInterpretation.cancelWeave();
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !productionInterpretation.isWeaving()) {
              event.preventDefault();
              productionInterpretation.beginWeave("keyboard");
            }
          }}
          onKeyUp={(event) => {
            if ((event.key === "Enter" || event.key === " ") && productionInterpretation.isWeaving()) {
              event.preventDefault();
              suppressClick.current = true;
              productionInterpretation.commitWeave();
            }
          }}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            productionInterpretation.commitAssistively();
          }}
          className="min-h-10 rounded-full border border-resonance/70 bg-resonance/15 px-5 py-2 font-ui text-xs uppercase tracking-[0.2em] text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow disabled:opacity-30"
        >
          {presentation.weaving ? "Release to Commit" : "Weave"}
        </button>

        <button
          type="button"
          disabled={!focusedBeadId}
          onClick={() => focusedBeadId && productionInterpretation.inspect(toConceptId(focusedBeadId))}
          className="rounded-full border border-line/40 px-3 py-1.5 font-ui text-xs text-dim disabled:opacity-30"
        >
          Details
        </button>
        <button
          type="button"
          disabled={draft.stage === "inactive" && !presentation.weaving}
          onClick={() => productionInterpretation.cancel()}
          className="rounded-full border border-line/40 px-3 py-1.5 font-ui text-xs text-dim disabled:opacity-30"
        >
          Cancel
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-center font-ui text-[11px] text-dim">
        {presentation.message}
      </p>
    </GlassPanel>
  );
}
