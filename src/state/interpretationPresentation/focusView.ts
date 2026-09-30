import { useStore as useVanillaStore } from "zustand";
import {
  deriveFocusView,
  type FocusView,
  type InterpretationDraft,
} from "../../runtime/interactionDraft";
import { interpretationDraftStore } from "../interactionDraft";
import { useStore } from "../store";
import { createFocusPresentationStore } from "./createFocusPresentationStore";
import { interpretationPresentationStore } from "./interpretationPresentationStore";

/** The one focus-presentation store used by the live application. */
export const focusPresentationStore = createFocusPresentationStore();

/**
 * The focus view, read once, outside React — for the scene's frame loop, the
 * cue directors and the browser test adapter. Every surface reads the same
 * derivation, so the fog, the lens, the cards and the tests cannot disagree.
 */
export function readFocusView(): FocusView {
  const settings = useStore.getState().settings;
  const focus = focusPresentationStore.getState();
  return deriveFocusView({
    draft: interpretationDraftStore.getState().draft,
    sightedConceptId: focus.sightedConceptId,
    dwellConceptId: focus.dwellConceptId,
    previewIntention: focus.previewIntention,
    reopened: focus.reopened,
    holding: interpretationPresentationStore.getState().weaving,
    profile: {
      reducedMotion: settings.reducedMotion,
      qualityTier: settings.qualityTier,
    },
  });
}

/**
 * The focus view as React state, for the column and the DOM mirror. It
 * re-derives only when one of its discrete inputs changes.
 */
export function useFocusView(): FocusView {
  const draft: InterpretationDraft = useVanillaStore(
    interpretationDraftStore,
    (state) => state.draft
  );
  const sightedConceptId = useVanillaStore(
    focusPresentationStore,
    (state) => state.sightedConceptId
  );
  const dwellConceptId = useVanillaStore(
    focusPresentationStore,
    (state) => state.dwellConceptId
  );
  const previewIntention = useVanillaStore(
    focusPresentationStore,
    (state) => state.previewIntention
  );
  const reopened = useVanillaStore(focusPresentationStore, (state) => state.reopened);
  const holding = useVanillaStore(
    interpretationPresentationStore,
    (state) => state.weaving
  );
  const reducedMotion = useStore((state) => state.settings.reducedMotion);
  const qualityTier = useStore((state) => state.settings.qualityTier);

  return deriveFocusView({
    draft,
    sightedConceptId,
    dwellConceptId,
    previewIntention,
    reopened,
    holding,
    profile: { reducedMotion, qualityTier },
  });
}
