import { useEffect, useRef } from "react";
import { useStore as useVanillaStore } from "zustand";
import { conceptById } from "@/content/concepts";
import { toConceptId } from "@/domain/ids";
import { productionInterpretation } from "@/runtime/interpretation";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { interpretationPresentationStore } from "@/state/interpretationPresentation";
import { useStore } from "@/state/store";

/**
 * A non-dominant semantic mirror of the world interaction. It supplies a
 * bounded keyboard/screen-reader path without putting a second arena on screen.
 */
export function InterpretationControls() {
  const beadIds = useStore((state) => state.session?.beadIds ?? []);
  const focusedBeadId = useStore((state) => state.focusedBeadId);
  const setFocusedBead = useStore((state) => state.setFocusedBead);
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const presentation = useVanillaStore(
    interpretationPresentationStore,
    (state) => state
  );
  const beadRefs = useRef(new Map<string, HTMLButtonElement>());
  const suppressCommitClick = useRef(false);
  const keyboardCaptureActive = useRef(false);

  useEffect(() => {
    const finishKeyboardCapture = (event: KeyboardEvent): void => {
      if (
        !keyboardCaptureActive.current ||
        (event.key !== "Enter" && event.key !== " ")
      ) {
        return;
      }
      event.preventDefault();
      keyboardCaptureActive.current = false;
      if (!productionInterpretation.isWeaving()) return;
      suppressCommitClick.current = true;
      productionInterpretation.commitWeave();
      window.queueMicrotask(() => {
        suppressCommitClick.current = false;
      });
    };
    const clearKeyboardCapture = (): void => {
      keyboardCaptureActive.current = false;
    };
    window.addEventListener("keyup", finishKeyboardCapture);
    window.addEventListener("blur", clearKeyboardCapture);
    return () => {
      window.removeEventListener("keyup", finishKeyboardCapture);
      window.removeEventListener("blur", clearKeyboardCapture);
      if (keyboardCaptureActive.current) {
        keyboardCaptureActive.current = false;
        productionInterpretation.cancelWeave();
      }
    };
  }, []);

  const attendedId =
    draft.stage === "inactive" ? null : String(draft.attendedConceptId);
  const candidateId =
    draft.stage === "candidate-selected"
      ? String(draft.candidateConceptId)
      : null;
  const rovingId = focusedBeadId ?? candidateId ?? attendedId ?? beadIds[0];

  const focusAt = (index: number): void => {
    if (beadIds.length === 0) return;
    const bounded = (index + beadIds.length) % beadIds.length;
    const id = beadIds[bounded];
    setFocusedBead(id);
    beadRefs.current.get(id)?.focus();
  };

  return (
    <section className="sr-only" aria-label="Interpretation controls">
      <div role="group" aria-label="Beads in this draw">
        {beadIds.map((id, index) => {
          const concept = conceptById.get(id);
          const selected = id === attendedId || id === candidateId;
          const band = presentation.candidateResonance.find(
            (candidate) => String(candidate.candidateId) === id
          )?.band;
          return (
            <button
              key={id}
              id={`bead-control-${id}`}
              ref={(element) => {
                if (element) beadRefs.current.set(id, element);
                else beadRefs.current.delete(id);
              }}
              type="button"
              data-testid={`bead-control-${id}`}
              aria-pressed={selected}
              aria-label={`${concept?.name ?? id}${band ? `, ${band} resonance` : ""}`}
              tabIndex={id === rovingId ? 0 : -1}
              onFocus={() => setFocusedBead(id)}
              onClick={() => {
                if (productionInterpretation.isWeaving()) return;
                productionInterpretation.activateConcept(toConceptId(id));
                setFocusedBead(id);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  focusAt(index + 1);
                } else if (
                  event.key === "ArrowLeft" ||
                  event.key === "ArrowUp"
                ) {
                  event.preventDefault();
                  focusAt(index - 1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  focusAt(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  focusAt(beadIds.length - 1);
                }
              }}
            >
              {concept?.name ?? id}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        data-testid="keyboard-weave-confirm"
        disabled={draft.stage !== "candidate-selected"}
        onKeyDown={(event) => {
          if (
            (event.key === "Enter" || event.key === " ") &&
            !productionInterpretation.isWeaving()
          ) {
            event.preventDefault();
            productionInterpretation.beginWeave("keyboard");
            keyboardCaptureActive.current = true;
          }
        }}
        onClick={() => {
          if (suppressCommitClick.current) {
            return;
          }
          productionInterpretation.commitAssistively();
        }}
      >
        Hold and release to Weave
      </button>

      <button
        type="button"
        data-testid="inspect-focused-bead"
        disabled={!focusedBeadId}
        onClick={() =>
          focusedBeadId &&
          productionInterpretation.inspect(toConceptId(focusedBeadId))
        }
      >
        Details for focused bead
      </button>
      <button
        type="button"
        data-testid="cancel-interpretation"
        disabled={draft.stage === "inactive" && !presentation.weaving}
        onClick={() => productionInterpretation.cancel()}
      >
        Step back
      </button>
      <p role="status" aria-live="polite">
        {presentation.message}
      </p>
      {presentation.failureMessage && (
        <p role="alert" aria-live="assertive">
          {presentation.failureMessage}
        </p>
      )}
    </section>
  );
}
