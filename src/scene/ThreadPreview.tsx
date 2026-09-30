import { useStore as useVanillaStore } from "zustand";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { useFocusView } from "@/state/interpretationPresentation";
import { previewStrandFor } from "./ribbon";
import { Ribbon } from "./Threads";

/**
 * The interpretation being considered, before anything durable exists.
 *
 * It uses the same material as a committed thread, so hearing Echo instead of
 * Tension changes the *construction* of the preview, not a colour on it
 * (I-012, I-016). It is rendered unresolved — the terminal stays open and the
 * ink stays wet — which is exactly what a draft is.
 *
 * Which strand, and in which grammar, is `ribbon.previewStrandFor`: the
 * unread strand to a sighted bead and between a locked pair nobody has read,
 * the heard or chosen reading's grammar once there is one. It used to wear
 * Echo's grammar as a placeholder, which showed every pair one reading's
 * construction before the player had read it.
 */
export function ThreadPreview() {
  const view = useFocusView();
  const readingChosen = useVanillaStore(
    interpretationDraftStore,
    (state) => state.draft.stage === "reading"
  );
  const strand = previewStrandFor(view, readingChosen);
  if (strand === null) return null;
  return (
    <Ribbon
      sourceId={strand.sourceId}
      targetId={strand.targetId}
      intention={strand.intention}
      opacity={strand.opacity}
      resolved={false}
      animateGrowth={false}
    />
  );
}
