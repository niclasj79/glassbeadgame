# M0 Persistence Map

## Durable stores found

The active application uses localStorage only. No IndexedDB access, service worker cache, backend call, cookie, or sessionStorage access exists under active `src/`. The URL hash is a separate, user-mediated transfer format.

## `gbg.v1` Zustand record

Owner: `src/state/store.ts::useStore`, via Zustand `persist` with `name: "gbg.v1"` and `version: 1`.

The browser value is Zustand's JSON envelope:

```ts
interface PersistEnvelopeV1 {
  state: {
    codex: Record<string, {
      firstFoundAt: number;
      count: number;
    }>;
    sessionArchive: Array<{
      id: string;
      seed: number;
      endedAt: number;
      disciplines: DisciplineId[];
      beadIds: string[];
      threads: Array<{
        id: string;
        a: string;
        b: string;
        kind: "curated" | "faint";
        tier: 0 | 1 | 2 | 3;
        createdAt: number;
        consecratedBy?: "triad" | "symposium" | "fugue";
      }>;
      discoveries: Array<{
        id: string;
        a: string;
        b: string;
        kind: "curated" | "faint";
        tier: 0 | 1 | 2 | 3;
        title: string;
        insight: string;
        quote?: { text: string; source: string };
        newToCodex: boolean;
        points: number;
      }>;
      motifs: Array<{
        motifId: "triad" | "symposium" | "fugue";
        name: string;
        points: number;
        at: number;
        beads?: string[];
      }>;
      score: number;
    }>;
    lifetimeStats: { sessions: number; totalScore: number };
    unlocks: string[];
    lastDaily: { date: string; score: number } | null;
    settings: {
      muted: boolean;
      binaural: boolean;
      hintsSeen: Record<string, boolean>;
    };
  };
  version: 1;
}
```

`partialize` is the source of truth for this list. `phase`, Lens/Codex/focus state, the live session, quality tier, and reduced-motion value are deliberately omitted. The archive is capped at the 12 most recent nonempty sessions.

### Hydration and validation exposure

`merge` supplies defaults for missing top-level fields and keeps device-derived `qualityTier`/`reducedMotion`, but it casts the stored value to `Partial<PersistedSlice>`. It does not validate nested types, connection/concept IDs, finite numbers, arrays, session snapshots, or content compatibility. The middleware version is 1, but there is no `migrate` function. Consequences:

- corrupt-but-valid JSON can hydrate malformed data into trusted application state;
- removed/renamed concept and connection IDs remain in archives/Codex;
- full authored discovery prose and point values are frozen into snapshots with no content-pack version;
- a future middleware version bump cannot currently translate version 1;
- browser quota/write errors are not surfaced to the player.

## `gbg.motifsCollapsed`

Owner: `src/ui/arena/MotifTracker.tsx::MotifTracker`.

- Shape: string `"1"` for collapsed, `"0"` for expanded; absence means expanded.
- Reads directly in the `useState` initializer and writes directly in `toggle`.
- It is a small preference appropriate for localStorage, but access is not guarded. A storage-denied environment can throw during render or toggle.
- `resetProgress` does not clear it.

## Legacy cleanup keys

Owner: startup loop in `src/main.tsx`.

Every load attempts to remove:

- exact `glass-bead-game-state`;
- exact `game-error-log`;
- every key beginning `session-offline`;
- every key beginning `movements-offline`.

The loop is wrapped in `try/catch`. The archived `legacy/` implementation is not active, but this cleanup is an active destructive same-origin migration behavior. It has no one-time migration marker and will delete any future key reusing those prefixes.

## Progress-transfer hash schema

Owner: `src/game/progress.ts`; producers/consumers are `ContinueLinkButton`, `App`, and `useStore.mergeProgress`.

`#gbg=<base64url(JSON)>` encodes:

```ts
interface SharedProgressV1 {
  version: 1;
  exportedAt: number;
  codex: Record<string, CodexEntry>;
  lifetimeStats: { sessions: number; totalScore: number };
  hintsSeen: Record<string, boolean>;
}
```

This boundary is substantially safer than localStorage hydration:

- tokens over 24,000 characters and malformed base64/JSON are rejected;
- version must equal 1;
- Codex IDs must exist in `connectionByPair` and entries require positive timestamps/counts;
- stats are finite nonnegative integers and only literal `true` hints survive;
- import merges earliest first-found, maximum count/stats, and the union of true hints;
- the hash is removed from browser history after import.

It does not transfer archives, unlocks, settings, daily state, or live sessions. `exportedAt` is accepted as zero if invalid and is not used for conflict resolution.

## ID and schema coupling

- Codex keys and discovery/thread IDs are `pairKey` values derived from lexical concept IDs.
- Archive `beadIds`, thread endpoints, discovery endpoints, and motif bead lists directly persist authored IDs.
- `lastDaily.date` is a `YYYY-MM-DD` UTC string by convention only.
- There is no persisted schema/content-pack version beyond Zustand middleware version 1.
- There is no event log, gesture record, declared relation, Open Thread entity, source/evidence data, or replay sequence/version.

## Migration hazards and safe seams

Highest risks:

1. Introducing IndexedDB/event logs while `gbg.v1` still writes Codex/archive can create two durable sources of truth.
2. Existing snapshots contain derived score, prose, motif awards, and discovery flags; treating them as canonical events would preserve presentation-era assumptions.
3. No validated reader exists for `gbg.v1`, so a migration must treat every field as unknown input despite TypeScript declarations.
4. Stable ID changes require an explicit mapping across Codex, archive endpoints, motif beads, and transfer tokens.
5. The startup legacy deletion loop must be accounted for when storage ownership changes.

Safe seams:

- `PersistedSlice`/`partialize` precisely enumerate data to fixture before migration.
- The cleaners in `src/game/progress.ts` demonstrate boundary-validation patterns and can be characterized independently.
- `SessionMemory` is clearly a legacy snapshot DTO; it can be imported as historical/read-only data while new event logs become canonical, provided writes are cut over once.
- Small preferences (`muted`, `binaural`, hints, motif collapse) can remain separately managed during an IndexedDB session migration if their ownership and reset behavior are explicit.
