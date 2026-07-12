# M0 State and Mutation Map

## Sources of state

| Owner | State | Durable? | Mutation mechanism |
| --- | --- | --- | --- |
| `src/state/store.ts::useStore` | phase, Lens/Codex state, settings, session, Codex, archive, lifetime stats, focus/pin, unlocks, daily result | Partially; exact persisted subset below | Named Zustand actions only; no external `useStore.setState` call was found |
| `src/scene/frameState.ts::frameState` | all per-frame positions, clocks, gestures' presentation targets, pulses/effects/camera flags | No | Direct writes from scene, pointer, and ambient audio code |
| `src/scene/threading.ts` module singleton | pointer ID/start/long-press timer/pressed bead and pointer speed | No | Pointer handlers/window listeners |
| React component state | setup picks, drawers/menus/toasts, replay index, confirmation/copy UI, WebGL loss | No | Component setters |
| `src/audio/engine.ts` and `ambient.ts` singletons | AudioContext/nodes, scheduler cursor, active motifs/patterns | No | Audio lifecycle and store subscriptions |
| Browser localStorage | `gbg.v1`, `gbg.motifsCollapsed`; legacy keys are deleted | Yes | Zustand persist middleware and `MotifTracker` |
| URL hash | transferable sanitized progress token | Transfer medium, not local owner | `ContinueLinkButton`/`App` |

## Zustand slices and selectors

`GBGState` is one store rather than formal slices. The following table covers every state field and its active selector/read set.

| Field | Meaning | Principal selector/read consumers |
| --- | --- | --- |
| `phase` | title/setup/arena/conclusion | `App`, `TitleScreen` indirectly through actions, `SoundToggle`, `CameraRig`, `ThreadingDriver`, `threading.ts`, `AudioBridge` subscription |
| `lensActive`, `lensView` | Lens mode and plane | `ArenaHud`, `Cosmos`, `CameraRig`, `Beads`, `LensAxes`, pointer guards |
| `codexOpen` | global Codex overlay | `CodexScreen` |
| `settings.muted` | master mute | `SoundToggle`, `AudioBridge` |
| `settings.binaural` | binaural bed preference | `SoundToggle`, `AudioBridge` subscription |
| `settings.qualityTier` | runtime graphics tier | `ArenaCanvas`, `Effects`, scene quality consumers via direct store reads/selectors |
| `settings.reducedMotion` | initial OS reduced-motion preference | `ArenaHud`, `CameraRig`, `Cosmos`, `Beads`, `threading.ts` |
| `settings.hintsSeen` | durable hint acknowledgements | `ArenaHud`, `SoundToggle`, progress export |
| `session` and `session.seed/disciplines/beadIds/themeId/daily` | current draw | setup/title actions; `Cosmos`, `Beads`, `ThreadingDriver`, HUD, conclusion, theme/audio consumers |
| `session.threads` | woven graph | `Threads`, `Membranes`, `Beads`, HUD/journal/conclusion, motif UI, AudioBridge subscription, rules and commit path |
| `session.discoveries` | attempt outcomes/order | HUD/journal/conclusion, `Cosmos` awakening, `AudioBridge`, Annotation/rules |
| `session.motifs` | awarded motif records | `MotifMarks`, motif UI, HUD/journal/conclusion, `AudioBridge`, Annotation |
| `session.score` | session score/ambient intensity | HUD/conclusion, `AudioBridge`, archive/lifetime finalization |
| `session.startedAt` | session wall-clock start | stored in live state but not otherwise consumed |
| `session.interaction` | pressed/threading/reveal/concluding state | pointer layer, `ThreadPreview`, `Beads`, `CameraRig`, HUD/cards, `AudioBridge` |
| `session.curatedAvailable` | hidden available-pair count | `Cosmos` awakening and HUD hint copy |
| `session.insight`, `illuminationsUsed` | illumination currency/seed step | HUD and `pickIlluminationTarget` |
| `codex` | durable curated discovery index | title/Codex/conclusion/WebGL fallback, rank/progress/milestones/export |
| `sessionArchive` | last 12 nonempty session snapshots | `CodexScreen`/`CodexAtlas` |
| `lifetimeStats` | completed-session count and score | title/progress export/import |
| `focusedBeadId`, `pinnedInspectId` | ephemeral inspection | `Beads`, `BeadInspectCard`, HUD hint tracking, pointer layer |
| `unlocks` | durable Great Web milestones | title epigraph and `Backdrop` |
| `lastDaily` | durable daily completion | `TitleScreen` |

## Zustand action inventory and callers

| Action | Mutation/rule owned | Caller set |
| --- | --- | --- |
| `goToSetup` | `phase = setup` | `TitleScreen`, `ConclusionScreen` |
| `returnToTitle` | clears current session and ephemeral modal/Lens/focus state | `SetupScreen`, `ArenaHud`, `ConclusionScreen` |
| `beginSession` | calls `drawSession`, constructs full session, uses `Date.now`, changes phase | `TitleScreen.startDaily`, `SetupScreen` |
| `setLens` | cancels non-idle interaction then sets Lens | No active caller found; public but currently unused |
| `cycleLens` | cancels interaction and advances Lens plane | `ArenaHud` |
| `setCodexOpen` | overlay flag | `App` WebGL fallback, title/HUD-conclusion-related screens, `CodexScreen` |
| `setFocusedBead` | hover/focus ID | `threading.ts`, `BeadInspectCard` |
| `setPinnedInspect` | pinned inspection ID | `threading.ts`, `BeadInspectCard` |
| `setMuted` | persisted setting | `SoundToggle` |
| `setBinaural` | persisted setting | `SoundToggle` |
| `setQualityTier` | device-derived nonpersisted setting | `ArenaCanvas` performance monitor |
| `markHintSeen` | persisted hint map | `ArenaHud`, `SoundToggle` |
| `mergeProgress` | max/union merge of imported Codex, stats, hints | `App` after `progressFromHash` |
| `resetProgress` | clears all durable progress except muted/binaural and resets live state | `TitleMenu` after confirmation |
| `setInteraction` | partial merge into session interaction | `threading.ts` only |
| `addThread` | de-duplicated append to session graph | `threading.ts::commit` |
| `addDiscovery` | Codex write/timestamp/count; discovery+motif append; score/Insight; unlock rules | `threading.ts::commit` |
| `spendInsight` | calls selection rule; decrements Insight/increments use count | `ArenaHud::illuminate` |
| `consecrateThreads` | marks faint threads and adds points | `threading.ts::commit` |
| `concludeSession` | sets interaction to concluding and disables Lens | `ArenaHud` |
| `finishConcluding` | creates timestamped archive, updates lifetime/daily data, changes phase | `ArenaHud` timer |

## Durable mutation call paths

Durability is supplied by Zustand `persist` after any store mutation, but `partialize` writes only Codex/archive/lifetime/unlocks/daily and muted/binaural/hints. Current-session writes become durable only when copied into the archive or Codex.

```text
Player weave
  -> threading.ts::commit
     -> addThread (live thread)
     -> addDiscovery
        -> codex (curated only; durable immediately)
        -> unlocks (durable immediately)
        -> discoveries/motifs/score/insight (live)
     -> consecrateThreads (live, optional)
  -> AudioBridge independent subscriptions + direct scene/SFX writes

Player concludes
  -> ArenaHud::concludeSession
  -> presentation timeout
  -> finishConcluding
     -> sessionArchive (durable snapshot)
     -> lifetimeStats (durable)
     -> lastDaily (durable when daily)
```

Other durable paths:

- `SoundToggle` -> `setMuted`/`setBinaural`/`markHintSeen` -> `gbg.v1`.
- `ArenaHud` -> `markHintSeen` -> `gbg.v1`.
- `App` -> `mergeProgress` -> imported Codex/stats/hints -> `gbg.v1`.
- `TitleMenu` -> `resetProgress` -> clears persisted progress on the next middleware write.
- `MotifTracker.toggle` writes `gbg.motifsCollapsed` directly, outside Zustand.
- `main.tsx` directly deletes matching legacy keys at every startup.

## Presentation consequences of one commit

One pointer commit currently fans out without a shared cue object:

1. `addThread` renders `Threads`/`Membranes` and causes `AudioBridge` to register an ambient motif.
2. `addDiscovery` updates UI, `Cosmos` awakening, score-driven ambient intensity, discovery chord/faint dyad, motifs, Codex, and unlock-backed backdrop.
3. `threading.ts` directly emits bursts, flare, camera kick, reveal time dilation, and optionally a consecration chime.
4. A curated reveal sets interaction state; `CameraRig`, `DiscoveryCard`, `AudioBridge`, `Cosmos`, and controls react independently.

The two/three store writes are synchronous but separately observable. If `addDiscovery` or later presentation work fails, a thread may already exist; there is no event/transaction that represents the whole weave.

## Nondeterministic mutation inputs

- Unseeded `drawSession` uses `Math.random`.
- Threads, motifs, Codex first-found timestamps, session IDs/end times, and progress export use `Date.now`.
- Daily identity depends on the UTC wall date.
- Audio voices, impulse response, gain/detune humanization, noise, and shimmer use `Math.random`.
- Camera idleness, pointer pulses, illumination, and frame animation use `performance.now`/frame delta.

## Migration hazards and seams

- Hazard: store actions combine validation, game rules, timestamps, persistence, and presentation-triggering state. Do not place an event reducer beside these actions without removing each replaced durable write.
- Hazard: `setLens` is unused public API; characterization should distinguish supported call paths from dead surface.
- Hazard: selector subscriptions use list lengths and read only the final item, so a future action that appends multiple discoveries/motifs at once could lose audio cues.
- Seam: characterize `drawSession`, `resolveAttempt`, motif helpers, progress cleaners, ranks, and Annotation before changing ownership.
- Seam: replace the single `threading.ts::commit` path with a command/event dispatch in a later task, preserving `devCommit` as a test adapter.
- Seam: capture full-state-before/after fixtures for `addDiscovery`, `consecrateThreads`, `mergeProgress`, reset, and conclusion to protect migration behavior.
