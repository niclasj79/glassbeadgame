import { useStore as useVanillaStore } from "zustand";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { focusPresentationStore } from "@/state/interpretationPresentation";
import { Ribbon } from "./Threads";

/**
 * The interpretation being considered, before anything durable exists.
 *
 * It uses the same material as a committed thread, so hearing Echo instead of
 * Tension changes the *construction* of the preview, not a colour on it
 * (I-012, I-016). It is rendered unresolved — the terminal stays open and the
 * ink stays wet — which is exactly what a draft is.
 *
 *   attending, a bead sighted   a faint thread from the attended bead to it
 *   locked                      the pair, in the hovered reading if any
 *   reading                     the pair, in the chosen reading
 */
export function ThreadPreview() {
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const sightedId = useVanillaStore(
    focusPresentationStore,
    (state) => state.sightedConceptId
  );
  const previewIntention = useVanillaStore(
    focusPresentationStore,
    (state) => state.previewIntention
  );

  if (draft.stage === "reading") {
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
  if (draft.stage === "locked") {
    return (
      <Ribbon
        sourceId={String(draft.attendedConceptId)}
        targetId={String(draft.candidateConceptId)}
        intention={previewIntention ?? "echo"}
        opacity={previewIntention === null ? 0.4 : 0.62}
        resolved={false}
        animateGrowth={false}
      />
    );
  }
  if (draft.stage === "attending" && sightedId !== null) {
    return (
      <Ribbon
        sourceId={String(draft.attendedConceptId)}
        targetId={String(sightedId)}
        intention="echo"
        opacity={0.28}
        resolved={false}
        animateGrowth={false}
      />
    );
  }
  return null;
}
