import type { FocusView, InterpretationDraft } from "@/runtime/interactionDraft";
import { interpretationDraftStore } from "@/state/interactionDraft";
import {
  focusPresentationStore,
  interpretationPresentationStore,
  readFocusView,
  type FocusPresentationState,
} from "@/state/interpretationPresentation";
import { useStore } from "@/state/store";
import type { Settings } from "@/state/types";

/**
 * THE FOCUS VIEW, AS THIS FRAME DRAWS IT (I-017).
 *
 * `readFocusView()` is the one answer to "what is the player attending to", and
 * every surface reads it. Three scene components read it *every frame* — the
 * camera, the beads and the fog — and a frame loop must not allocate, while a
 * fresh derivation is a handful of frozen objects. So the frame reads it
 * through `sampleFocusView`, which re-derives only when one of the view's own
 * inputs has actually changed and otherwise hands back the view it already
 * has. It is a cache of that one derivation, never a second one: the rules
 * stay in `deriveFocusView`.
 *
 * Beside it, the few per-frame facts the fog and the beads must agree on and
 * that no store may carry, because they move at the rate of the frame: how
 * large each bead is drawn and where its name hangs (written by `Beads`, read
 * by the fog so the clear air sits on the glass and the caption), and the lens
 * as it is actually being drawn and which beads are under it (written by the
 * fog, read by `Beads` so the names under the lens are the lens's). Derived
 * presentation, recomputed every frame; nothing here is a source of truth.
 */
export const focusFrame = {
  /**
   * Drawn glass radius per bead, in world units, indexed like
   * `frameState.beadIndex`. 0 until `Beads` has drawn it.
   */
  radius: new Float32Array(0),
  /**
   * Each bead's name, as a box relative to the bead in the arena's isotropic
   * screen units (one unit is half the frame's height, x carrying the aspect):
   * dx, dy, hx, hy — four per bead, indexed like `frameState.beadIndex`.
   * hx is 0 while no name is drawn.
   */
  names: new Float32Array(0),
  /**
   * 1 for a bead inside the lens's disc, indexed like `frameState.beadIndex`.
   * Measured by the fog from inside the render — where the camera is exactly
   * the one the frame is drawn with — and read by `Beads` a frame later to
   * name what the lens is over.
   */
  lensed: new Float32Array(0),
  /**
   * The lens as drawn this frame: its centre in viewport-normalised
   * coordinates (0..1, origin top-left, like `frameState.lens`), damped toward
   * the hand, and how present it is (0..1).
   */
  lens: { x: 0.5, y: 0.5, strength: 0 },
};

/** Size the per-bead arrays for a draw of `count` beads. Only on change. */
export function sizeFocusFrame(count: number): void {
  const n = Math.max(0, count);
  if (focusFrame.radius.length !== n) focusFrame.radius = new Float32Array(n);
  if (focusFrame.names.length !== n * 4) focusFrame.names = new Float32Array(n * 4);
  if (focusFrame.lensed.length !== n) focusFrame.lensed = new Float32Array(n);
}

interface SampledInputs {
  draft: InterpretationDraft | null;
  focus: FocusPresentationState | null;
  weaving: boolean;
  settings: Settings | null;
  view: FocusView | null;
}

const sampled: SampledInputs = {
  draft: null,
  focus: null,
  weaving: false,
  settings: null,
  view: null,
};

/**
 * The focus view, for a frame loop. The inputs compared here are exactly the
 * ones `readFocusView` reads — the draft, the focus store, the weave hold and
 * the settings — each by identity, so an unchanged world costs four
 * comparisons and no allocation.
 */
export function sampleFocusView(): FocusView {
  const draft = interpretationDraftStore.getState().draft;
  const focus = focusPresentationStore.getState();
  const weaving = interpretationPresentationStore.getState().weaving;
  const settings = useStore.getState().settings;
  if (
    sampled.view !== null &&
    sampled.draft === draft &&
    sampled.focus === focus &&
    sampled.weaving === weaving &&
    sampled.settings === settings
  ) {
    return sampled.view;
  }
  sampled.draft = draft;
  sampled.focus = focus;
  sampled.weaving = weaving;
  sampled.settings = settings;
  sampled.view = readFocusView();
  return sampled.view;
}

/**
 * Subscribe to every input of the focus view — for `useSyncExternalStore`, so
 * a React surface re-renders only when the snapshot it takes of the view
 * actually changes.
 */
export function subscribeFocusView(listener: () => void): () => void {
  const unsubscribers = [
    interpretationDraftStore.subscribe(listener),
    focusPresentationStore.subscribe(listener),
    interpretationPresentationStore.subscribe(listener),
    useStore.subscribe(listener),
  ];
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
