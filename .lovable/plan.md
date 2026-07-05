## Goal
On mobile, the `BeadInspectCard` covers >50% of the screen and hides the beads you're trying to weave to. Suppress the card during weaving on coarse-pointer devices; keep desktop behavior unchanged.

## Change
Single file: `src/ui/arena/BeadInspectCard.tsx`.

- Detect coarse pointer once via `isCoarsePointer()` from `@/lib/device` (already used in `ArenaHud`).
- Currently the shown id is `explicitFocus ?? interactionFocus`. On coarse pointers, drop the `interactionFocus` fallback so the card only appears when the user explicitly taps a bead to focus it (not while a thread is being drawn from a `fromId`).
- Desktop (fine pointer) keeps the current behavior — full card shows during weaving.

Effectively:
```
const coarse = useMemo(isCoarsePointer, []);
const id = explicitFocus ?? (coarse ? null : interactionFocus);
```

No layout, styling, or state-store changes. No other components touched.

## Why not a smaller mobile chip
User chose "Suppress during weaving" — the interaction focus (a bead picked as the thread's start) is exactly the weaving state, so hiding the card in that state resolves the occlusion without introducing a new mobile-only UI surface. Users can still get the full card on mobile by tapping a bead to explicitly focus it (which sets `focusedBeadId`) when they want to read it.