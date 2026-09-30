import { useEffect, useRef } from "react";
import { useStore as useVanillaStore } from "zustand";
import { castaliaConceptById } from "@/content/castalia";
import { toConceptId, type ThreadId } from "@/domain/ids";
import type { CommittedThreadV1 } from "@/domain/model";
import { productionInterpretation } from "@/runtime/interpretation";
import { domainSessionStore } from "@/state/domainSession";
import { interpretationDraftStore } from "@/state/interactionDraft";
import {
  interpretationPresentationStore,
  useFocusView,
} from "@/state/interpretationPresentation";
import { useStore } from "@/state/store";
import { useStudy } from "@/state/studies";
import { reopenWovenThread, wovenThreadLabel } from "./columnPlan";
import { useHeldWhileLeaving } from "./presence";
import { declareSilence } from "./studyMode";
import { selectBeadIds } from "./selectBeadIds";

const NO_THREADS: readonly CommittedThreadV1[] = Object.freeze([]);
export interface WovenThreadListProps {
  /** The committed threads, in the order they were woven. */
  readonly threads: readonly Pick<CommittedThreadV1, "id" | "pair" | "intention">[];
  /** The thread reopened for reading right now, if any. */
  readonly reopenedThreadId: ThreadId | null;
  /** Reopening is a roaming act: it waits while a pair is being composed. */
  readonly disabled: boolean;
  readonly onReopen: (threadId: ThreadId) => void;
}

/**
 * THE WAY BACK TO A THREAD WITHOUT A POINTER (I-019).
 *
 * A committed thread can be clicked or tapped in the world; this is the same
 * act for a keyboard or a screen reader. Each entry names the reading as the
 * player composed it — "Fibonacci Sequence · Echo · Counterpoint" — and never
 * how it fared, because the list is a way back to a thread, not a tally of
 * outcomes. Hook-free, so what each entry does can be asserted directly.
 */
export function WovenThreadList({
  threads,
  reopenedThreadId,
  disabled,
  onReopen,
}: WovenThreadListProps) {
  if (threads.length === 0) return null;
  return (
    <ul aria-label="Woven threads">
      {threads.map((thread) => (
        <li key={String(thread.id)}>
          <button
            type="button"
            data-testid={`woven-thread-${String(thread.id)}`}
            aria-current={thread.id === reopenedThreadId ? "true" : undefined}
            disabled={disabled}
            onClick={() => onReopen(thread.id)}
          >
            {wovenThreadLabel(thread)}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * *IT CANNOT BE DONE*, IN THE MIRROR (STUDIES-SPEC §7).
 *
 * The silence control exists in the world's margin and here, on every Study,
 * so a keyboard or a screen reader can give the same answer with no pointer.
 * It is worded exactly as the margin words it, and what the Game answers —
 * *not yet*, or the solved plate — is said by the margin's own line and by the
 * plate, not repeated here. Hook-free, so what it does can be pressed.
 */
export function StudySilenceMirror() {
  return (
    <button
      type="button"
      data-testid="study-declare-silence-mirror"
      onClick={() => declareSilence()}
    >
      It cannot be done
    </button>
  );
}

/**
 * A non-dominant semantic mirror of the world interaction. It supplies a
 * bounded keyboard/screen-reader path without putting a second arena on screen.
 */
export function InterpretationControls() {
  // Held while the page leaves: a Study leaves by discarding its session, and
  // the mirror fades out listing the beads it listed, not an empty draw.
  const beadIds = useHeldWhileLeaving(useStore(selectBeadIds));
  // A Study adds one answer to the mirror; the Free Game's mirror is unchanged (R4).
  const studying = useHeldWhileLeaving(useStudy((state) => state.studyId !== null));
  const focusedBeadId = useStore((state) => state.focusedBeadId);
  const setFocusedBead = useStore((state) => state.setFocusedBead);
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const presentation = useVanillaStore(
    interpretationPresentationStore,
    (state) => state
  );
  // Read from the canonical session, never from a copy: a thread is listed
  // here because the log holds it.
  const threads = useVanillaStore(
    domainSessionStore,
    (state) => state.session?.threads ?? NO_THREADS
  );
  const { reopenedThreadId } = useFocusView();
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
      if (!productionInterpretation.isHolding()) return;
      suppressCommitClick.current = true;
      productionInterpretation.commitHold();
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
        productionInterpretation.cancelHold();
      }
    };
  }, []);

  const attendedId =
    draft.stage === "inactive" ? null : String(draft.attendedConceptId);
  const candidateId =
    draft.stage === "locked" || draft.stage === "reading"
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
          const concept = castaliaConceptById.get(id);
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
              onFocus={() => {
                setFocusedBead(id);
                // The keyboard's lens: focusing a bead while attending sights it.
                if (draft.stage === "attending") {
                  productionInterpretation.sight(toConceptId(id));
                }
              }}
              onClick={() => {
                if (productionInterpretation.isHolding()) return;
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
        disabled={draft.stage !== "reading"}
        onKeyDown={(event) => {
          if (
            (event.key === "Enter" || event.key === " ") &&
            !productionInterpretation.isHolding()
          ) {
            event.preventDefault();
            productionInterpretation.beginHold("keyboard");
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
        disabled={
          draft.stage === "inactive" &&
          !presentation.weaving &&
          reopenedThreadId === null
        }
        onClick={() => productionInterpretation.cancel()}
      >
        Step back
      </button>
      {studying && <StudySilenceMirror />}
      <WovenThreadList
        threads={threads}
        reopenedThreadId={reopenedThreadId}
        disabled={draft.stage !== "inactive"}
        onReopen={(threadId) => reopenWovenThread(productionInterpretation, threadId)}
      />
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
