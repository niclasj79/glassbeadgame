import { useStore as useVanillaStore } from "zustand";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { interpretationPresentationStore } from "@/state/interpretationPresentation";
import { Ribbon } from "./Threads";

/**
 * The interpretation being drawn, before anything durable exists.
 *
 * It uses the same material as a committed thread, so arming Echo instead of
 * Tension changes the *construction* of what the player is dragging, not a
 * colour on it (I-012: intention changes preview behaviour immediately). It is
 * rendered unresolved — the terminal stays open and the ink stays wet — which
 * is exactly what a draft is.
 */
export function ThreadPreview() {
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const weaving = useVanillaStore(
    interpretationPresentationStore,
    (state) => state.weaving
  );

  if (draft.stage === "candidate-selected") {
    return (
      <Ribbon
        sourceId={String(draft.attendedConceptId)}
        targetId={String(draft.candidateConceptId)}
        intention={draft.intention}
        opacity={0.72}
        resolved={false}
        animateGrowth={false}
      />
    );
  }
  if (draft.stage !== "armed" || !weaving) return null;
  return (
    <Ribbon
      sourceId={String(draft.attendedConceptId)}
      targetId={null}
      intention={draft.intention}
      opacity={0.6}
      resolved={false}
      animateGrowth={false}
    />
  );
}
