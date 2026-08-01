import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_ELEVATION, createOrbitPose, type OrbitPose } from "./framing";
import {
  CROWN_ELEVATION,
  createConclusionCamera,
  focusFrom,
  hintsDueThrough,
  performedPose,
  readScenePerformance,
  runningConclusionFor,
  threadLightingTimes,
  type PerformedCameraHint,
  type PerformedPose,
  type ScenePerformance,
  type SceneHintKind,
  type Vec3,
} from "./conclusionPerformance";

/**
 * BLOCK-1 — THE CONCLUSION WAS COMPILED IN FULL AND PERFORMED BY NOTHING.
 *
 * `compileConclusion` emits an ordered `CameraHint[]` — answer, traverse, hold,
 * settle, gather, widen, rest — each with the sentence that justifies it, plus
 * the climax the web's own weight located. Before this module,
 * `grep -rn CameraHint src/` returned the compiler, the type file and the
 * barrel: **zero consumers**. `ConclusionScreen` states twice that the hints
 * "belong to the scene"; nothing under `src/scene` had ever claimed them. The
 * rig sent the conclusion to one fixed crown pose and never moved it again, so
 * spec §14 — "topology variables shape camera, density, orchestration, and
 * climax", "the climax belongs to the player's web" — was unreachable in play.
 *
 * Every test below fails against that tree. The last two fail by construction —
 * they read the two components back and would pass for no other reason than
 * that the components actually consume this module.
 */

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

function hint(
  atSeconds: number,
  kind: SceneHintKind,
  conceptIds: readonly string[] = [],
  threadId: string | null = null
): PerformedCameraHint {
  return {
    atSeconds,
    kind,
    conceptIds,
    threadId,
    reason: `${kind} at ${atSeconds}`,
  };
}

/**
 * A performance shaped exactly as the compiler shapes one: entries in creation
 * order, one camera hint per entry at the entry's own second, and a closing
 * rest. Written out rather than compiled so this suite pins the *scene's* law
 * and cannot be moved by an edit to the domain.
 */
function performance(overrides: Partial<ScenePerformance> = {}): ScenePerformance {
  return {
    sessionId: "session:test",
    secondsPerBeat: 1,
    totalSeconds: 20,
    entries: [
      { threadId: "t1", order: 0, atSeconds: 0, durationSeconds: 4 },
      { threadId: "t2", order: 1, atSeconds: 5, durationSeconds: 4 },
      { threadId: "t3", order: 2, atSeconds: 10, durationSeconds: 4 },
    ],
    camera: [
      hint(0, "answer", ["a", "b"], "t1"),
      hint(5, "traverse", ["c", "d"], "t2"),
      hint(10, "hold", ["a", "c"], "t3"),
      hint(16, "rest", ["c", "d"], "t2"),
    ],
    ...overrides,
  };
}

/** A ring of beads at a known radius, so a pose can be checked by hand. */
const BEADS: Readonly<Record<string, Vec3>> = {
  a: { x: 3, y: 0, z: 0 },
  b: { x: 0, y: 0, z: 3 },
  c: { x: -3, y: 0, z: 0 },
  d: { x: 0, y: 0, z: -3 },
};

const beadAt = (id: string): Vec3 | null => BEADS[id] ?? null;

function orbit(distance: number, azimuth = 0, elevation = 0.1): OrbitPose {
  const pose = createOrbitPose();
  pose.distance = distance;
  pose.azimuth = azimuth;
  pose.elevation = elevation;
  return pose;
}

interface Played {
  readonly atMs: number;
  readonly pose: PerformedPose;
}

/**
 * Drive the rig's loop the way `CameraRig` drives it: one advance per frame,
 * from the current camera pose, over a wall clock. The camera arrives where the
 * last pose asked it to, which is what makes "hold does not travel" and "the
 * crown is last" observable rather than asserted.
 */
function play(
  running: { performance: ScenePerformance; startedAtMs: number },
  throughMs: number,
  options: { readonly frameMs?: number; readonly interruptAtMs?: number } = {}
): Played[] {
  const camera = createConclusionCamera();
  const frameMs = options.frameMs ?? 100;
  const played: Played[] = [];
  let from = orbit(11);
  let interrupted = false;
  for (let atMs = running.startedAtMs; atMs <= throughMs; atMs += frameMs) {
    if (
      options.interruptAtMs !== undefined &&
      !interrupted &&
      atMs >= options.interruptAtMs
    ) {
      camera.interrupt();
      interrupted = true;
    }
    const pose = camera.advance({
      running,
      nowMs: atMs,
      from,
      beadAt,
      webRadius: 3,
      minDistance: 5.2,
      maxDistance: 18,
    });
    if (pose === null) continue;
    played.push({ atMs, pose });
    // The rig damps toward the pose; for the purposes of the next hint's
    // "where the camera is now", it has arrived.
    from = orbit(pose.distance, pose.azimuth, pose.elevation);
  }
  return played;
}

describe("the compiled conclusion reaches the scene at all", () => {
  it("performs every hint, in the compiler's order, at the compiler's seconds", () => {
    const p = performance();
    const played = play({ performance: p, startedAtMs: 1000 }, 1000 + 20_000);

    expect(played.map(({ pose }) => pose.kind)).toEqual([
      "answer",
      "traverse",
      "hold",
      "rest",
    ]);
    // Each within one frame of the second the compiler put it at — never early.
    for (let i = 0; i < played.length; i++) {
      const due = p.camera[i].atSeconds * 1000 + 1000;
      expect(played[i].atMs).toBeGreaterThanOrEqual(due);
      expect(played[i].atMs).toBeLessThan(due + 100);
    }
  });

  it("performs nothing at all before the first hint is due", () => {
    const p = performance({
      camera: [hint(4, "answer", ["a", "b"], "t1"), hint(9, "rest")],
    });
    expect(play({ performance: p, startedAtMs: 0 }, 3_900)).toHaveLength(0);
  });

  it("carries the reason the compiler wrote onto the pose it produced", () => {
    // The hints are not a set of enum values with times attached: each says why.
    // A scene that dropped the sentence would be performing an animation.
    const played = play({ performance: performance(), startedAtMs: 0 }, 20_000);
    expect(played.map(({ pose }) => pose.reason)).toEqual([
      "answer at 0",
      "traverse at 5",
      "hold at 10",
      "rest at 16",
    ]);
  });

  it("takes the last hint it missed rather than replaying a throttled tab", () => {
    // A backgrounded tab returns to a schedule it has already passed. Three
    // superseded poses in one frame are three poses nobody sees.
    const played = play({ performance: performance(), startedAtMs: 0 }, 30_000, {
      frameMs: 12_000,
    });
    // Frames at 0, 12 and 24 seconds: `traverse` fell inside a gap and is
    // carried over rather than performed after the hint that superseded it.
    expect(played.map(({ pose }) => pose.kind)).toEqual([
      "answer",
      "hold",
      "rest",
    ]);
  });

  it("lets the climax supersede the entry it was compiled onto", () => {
    /*
     * Not hypothetical. Driving the running build: a four-thread session
     * compiled `hold` and `widen` both at 18.679238 s, because the compiler
     * emits the climax at the beat of the entry that carries it. One instant
     * cannot be two poses; the later hint is the climax, and the climax is what
     * §14 puts in the camera.
     */
    const p = performance({
      camera: [
        hint(0, "answer", ["a", "b"], "t1"),
        hint(9, "hold", ["a", "c"], "t3"),
        hint(9, "widen", [], "t3"),
        hint(16, "rest", ["c", "d"], "t2"),
      ],
    });
    const played = play({ performance: p, startedAtMs: 0 }, 20_000);
    expect(played.map(({ pose }) => pose.kind)).toEqual([
      "answer",
      "widen",
      "rest",
    ]);
  });

  it("ends on the crown, above the web, and no later hint takes it back", () => {
    const played = play({ performance: performance(), startedAtMs: 0 }, 60_000);
    const last = played[played.length - 1].pose;
    expect(last.kind).toBe("rest");
    expect(last.phrase).toBe("crown");
    expect(last.elevation).toBeCloseTo(CROWN_ELEVATION, 5);
    // Clear of the furthest bead, and reachable: a pose outside the controls'
    // ceiling is a move that can never arrive.
    expect(last.distance).toBeGreaterThan(3);
    expect(last.distance).toBeLessThanOrEqual(18);
  });
});

describe("a performance, not a cutscene", () => {
  it("drops every remaining hint the moment the player takes the camera", () => {
    const played = play({ performance: performance(), startedAtMs: 0 }, 20_000, {
      interruptAtMs: 6_000,
    });
    expect(played.map(({ pose }) => pose.kind)).toEqual(["answer", "traverse"]);
  });

  it("stops owning the camera once it has been taken", () => {
    const camera = createConclusionCamera();
    const running = { performance: performance(), startedAtMs: 0 };
    camera.advance({
      running,
      nowMs: 0,
      from: orbit(11),
      beadAt,
      webRadius: 3,
      minDistance: 5.2,
      maxDistance: 18,
    });
    expect(camera.owns(1_000)).toBe(true);
    camera.interrupt();
    expect(camera.owns(1_000)).toBe(false);
  });

  it("hands the arena back a few seconds after the last hint", () => {
    // Otherwise the idle drift is suppressed forever on the conclusion screen.
    const camera = createConclusionCamera();
    const running = { performance: performance(), startedAtMs: 0 };
    const step = (nowMs: number): void => {
      camera.advance({
        running,
        nowMs,
        from: orbit(11),
        beadAt,
        webRadius: 3,
        minDistance: 5.2,
        maxDistance: 18,
      });
    };
    step(0);
    expect(camera.owns(16_000)).toBe(true);
    expect(camera.owns(30_000)).toBe(false);
  });

  it("starts a new session's performance from the beginning", () => {
    const camera = createConclusionCamera();
    const first = { performance: performance(), startedAtMs: 0 };
    const sample = (
      running: typeof first,
      nowMs: number
    ): PerformedPose | null =>
      camera.advance({
        running,
        nowMs,
        from: orbit(11),
        beadAt,
        webRadius: 3,
        minDistance: 5.2,
        maxDistance: 18,
      });
    sample(first, 12_000);
    camera.interrupt();
    const second = {
      performance: performance({ sessionId: "session:second" }),
      startedAtMs: 100_000,
    };
    expect(sample(second, 100_000)?.kind).toBe("answer");
  });

  it("refuses a performance belonging to a session that has ended", () => {
    const running = { performance: performance(), startedAtMs: 0 };
    expect(runningConclusionFor(running, "session:test")).toBe(running);
    expect(runningConclusionFor(running, "session:another")).toBeNull();
    expect(runningConclusionFor(running, null)).toBeNull();
    expect(runningConclusionFor(null, "session:test")).toBeNull();
  });
});

describe("each hint means something the camera can be seen doing", () => {
  const from = orbit(11, 0.4, 0.2);
  const pose = (kind: SceneHintKind, ids: readonly string[]): PerformedPose =>
    performedPose({
      hint: hint(0, kind, ids),
      focus: focusFrom(ids.map((id) => BEADS[id]).filter(Boolean)),
      webRadius: 3,
      from,
      minDistance: 5.2,
      maxDistance: 18,
    });

  it("holds a Tension where it stands — displaced, and staying so", () => {
    const held = pose("hold", ["a", "c"]);
    expect(held.azimuth).toBe(from.azimuth);
    expect(held.elevation).toBe(from.elevation);
    expect(held.phrase).toBe("breath");
    // The one hint that does not travel: a breath inward and nothing else.
    expect(held.distance).toBeLessThan(from.distance);
    expect(held.distance).toBeGreaterThan(from.distance * 0.9);
  });

  it("goes under for a Ground and comes round for an Echo", () => {
    expect(pose("settle", ["a", "b"]).elevation).toBeLessThan(from.elevation);
    expect(pose("settle", ["a", "b"]).azimuth).toBe(from.azimuth);
    // Echo stands square to the axis between the pair, so the restatement is
    // seen across a gap rather than through one bead.
    const answer = pose("answer", ["a", "c"]);
    expect(answer.phrase).toBe("dwell");
    // a→c runs along x; square to it is the z axis, i.e. azimuth 0 or π.
    expect(Math.abs(Math.sin(answer.azimuth))).toBeLessThan(1e-6);
  });

  it("stands along the axis for a Passage, so the crossing runs into depth", () => {
    const traverse = pose("traverse", ["a", "c"]);
    expect(traverse.phrase).toBe("lean");
    // a→c runs along x; along it is azimuth ±π/2.
    expect(Math.abs(Math.cos(traverse.azimuth))).toBeLessThan(1e-6);
  });

  it("answers the climax by widening onto the whole web, not by pointing", () => {
    // §14 puts the climax in the camera. ADR-010 forbids printing a best
    // thread. A widen names no concepts and aims at the arena's centre, which
    // is the only reading of "the climax belongs to the player's web" that does
    // not re-introduce the number.
    const widen = pose("widen", []);
    expect(widen.target).toEqual(ORIGIN);
    expect(widen.distance).toBeGreaterThan(pose("answer", ["a", "b"]).distance);
  });

  it("never throws the level away on a composing move", () => {
    for (const kind of ["answer", "traverse", "settle", "gather", "widen"] as const) {
      const at = pose(kind, ["a", "b"]);
      expect(Math.abs(at.elevation)).toBeLessThanOrEqual(MAX_ELEVATION + 1e-9);
    }
    // The crown is the documented exception: seeing the whole web from above is
    // information, and it is the one phrase that leaves the level behind.
    expect(pose("rest", ["a", "b"]).elevation).toBeGreaterThan(MAX_ELEVATION);
  });

  it("keeps every pose inside the orbit the controls actually allow", () => {
    for (const kind of [
      "answer",
      "traverse",
      "hold",
      "settle",
      "gather",
      "widen",
      "rest",
    ] as const) {
      const at = pose(kind, ["a", "b"]);
      expect(at.distance).toBeGreaterThanOrEqual(5.2);
      expect(at.distance).toBeLessThanOrEqual(18);
      // And the aim stays within the room the instrument leaves at that
      // distance, so a conclusion can never pan the web out of its own frame.
      expect(Math.hypot(at.target.x, at.target.y, at.target.z)).toBeLessThan(1.7);
    }
  });

  it("takes the short way round to a station that has an antipode", () => {
    // Both stations square to an axis frame the pair identically, so a swing of
    // a hundred and eighty degrees would be motion that shows nothing new.
    const near = performedPose({
      hint: hint(0, "answer", ["a", "c"]),
      focus: focusFrom([BEADS.a, BEADS.c]),
      webRadius: 3,
      from: orbit(11, 0.2, 0),
      minDistance: 5.2,
      maxDistance: 18,
    });
    expect(Math.abs(near.azimuth - 0.2)).toBeLessThan(Math.PI / 2);
  });

  it("falls back to the arena's centre when the world cannot place a bead", () => {
    // A hint naming concepts the arena has not laid out must still be a pose.
    const nowhere = performedPose({
      hint: hint(0, "answer", ["missing"]),
      focus: focusFrom([]),
      webRadius: 3,
      from,
      minDistance: 5.2,
      maxDistance: 18,
    });
    expect(Number.isFinite(nowhere.distance)).toBe(true);
    expect(Number.isFinite(nowhere.azimuth)).toBe(true);
    expect(nowhere.target).toEqual(ORIGIN);
  });
});

describe("the web is rebuilt in the order the player made it", () => {
  it("lights each strand at the second its own voice enters", () => {
    const times = threadLightingTimes(performance(), ["t1", "t2", "t3"]);
    expect([...times.values()]).toEqual([0, 5, 10]);
  });

  it("follows creation order, not the order the arena happens to hold them", () => {
    const times = threadLightingTimes(performance(), ["t3", "t1", "t2"]);
    expect(times.get("t1")).toBe(0);
    expect(times.get("t2")).toBe(5);
    expect(times.get("t3")).toBe(10);
  });

  it("still gives back a strand the compiler dropped, on the next beat", () => {
    // The register does exactly this with the same case. Nothing may withhold a
    // strand the player wove.
    const times = threadLightingTimes(performance(), ["t1", "t2", "t3", "t4"]);
    expect(times.get("t4")).toBe(15);
  });

  it("never holds a strand for a time that can never arrive", () => {
    // The narrowing is shallow by design (see `readScenePerformance`), so an
    // entry with an unreadable time can reach here. Withholding that strand
    // forever is the one outcome that is not allowed: it would erase something
    // the player wove.
    const p = performance({
      entries: [
        { threadId: "t1", order: 0, atSeconds: Number.NaN, durationSeconds: 4 },
        { threadId: "t2", order: 1, atSeconds: 5, durationSeconds: Number.NaN },
      ],
    });
    const times = threadLightingTimes(p, ["t1", "t2", "t3"]);
    for (const [threadId, at] of times) {
      expect(Number.isFinite(at), `${threadId} lights at ${at}`).toBe(true);
    }
  });

  it("gives a documented, an open and an unresolved entry the same treatment", () => {
    // CAV-006: they differ in resolution, never in reward. Two entries at the
    // same compiled second light at the same second, whatever they resolved to
    // — the map is built from times and creation order and reads no outcome.
    const p = performance({
      entries: [
        { threadId: "documented", order: 0, atSeconds: 3, durationSeconds: 4 },
        { threadId: "open", order: 1, atSeconds: 3, durationSeconds: 4 },
        { threadId: "unresolved", order: 2, atSeconds: 3, durationSeconds: 4 },
      ],
    });
    const times = threadLightingTimes(p, ["documented", "open", "unresolved"]);
    expect([...times.values()]).toEqual([3, 3, 3]);
  });
});

describe("what the scene refuses to invent", () => {
  it("performs nothing at all when the payload is not a performance", () => {
    // Silence beats fabricated significance.
    for (const junk of [null, undefined, 42, "performance", {}, []]) {
      expect(readScenePerformance(junk)).toBeNull();
    }
  });

  it("refuses a performance with no camera in it rather than posing anyway", () => {
    expect(
      readScenePerformance({
        sessionId: "s",
        secondsPerBeat: 1,
        totalSeconds: 4,
        camera: [],
        entries: [],
      })
    ).toBeNull();
  });

  it("keeps only hints it can actually perform, in ascending time", () => {
    // A kind with no phrase is a kind the scene does not know how to perform,
    // and a hint with no readable time can never come due: both are dropped
    // rather than guessed at. Everything else is put in the order the cursor
    // depends on.
    const read = readScenePerformance({
      sessionId: "s",
      secondsPerBeat: 1,
      totalSeconds: 9,
      camera: [
        { atSeconds: 6, kind: "rest", conceptIds: [], threadId: null, reason: "" },
        { atSeconds: 1, kind: "not-a-kind", conceptIds: [], threadId: null },
        { atSeconds: Number.NaN, kind: "gather", conceptIds: [], threadId: null },
        { atSeconds: 2, kind: "answer", conceptIds: ["a"], threadId: "t", reason: "why" },
      ],
      entries: [
        { threadId: "b", order: 1, atSeconds: 4, durationSeconds: 3 },
        { threadId: "a", order: 0, atSeconds: 2, durationSeconds: 3 },
      ],
    });
    expect(read).not.toBeNull();
    expect(read!.camera.map((c) => c.kind)).toEqual(["answer", "rest"]);
    // Entries reach the strands in creation order whatever order they arrived.
    expect(read!.entries.map((e) => e.threadId)).toEqual(["a", "b"]);
  });

  it("refuses a payload whose beat it cannot divide by", () => {
    // The beat is the fallback for a thread the compiler dropped; a zero or a
    // NaN there is a schedule of times that never arrive.
    for (const secondsPerBeat of [0, -1, Number.NaN, "1", undefined]) {
      expect(
        readScenePerformance({
          sessionId: "s",
          secondsPerBeat,
          totalSeconds: 9,
          camera: [{ atSeconds: 0, kind: "rest", conceptIds: [], threadId: null }],
          entries: [],
        })
      ).toBeNull();
    }
  });

  it("reads a real compiled performance without being told its shape", () => {
    // The structural subset is declared, not imported. This is the one place
    // the compiler's field names are checked against it.
    const compiled = {
      sessionId: "session:x",
      seed: "x",
      tempoBpm: 61,
      beatsPerBar: 4,
      secondsPerBeat: 0.983607,
      entries: [
        {
          threadId: "thread:1",
          order: 0,
          sequence: 3,
          conceptIds: ["a", "b"],
          intention: "echo",
          atSeconds: 0,
          durationSeconds: 6.88,
        },
      ],
      camera: [
        {
          atBeat: 0,
          atSeconds: 0,
          kind: "answer",
          conceptIds: ["a", "b"],
          threadId: "thread:1",
          reason: "Echo between two beads already in the web.",
        },
      ],
      totalSeconds: 31.47,
    };
    const read = readScenePerformance(compiled);
    expect(read?.camera[0].conceptIds).toEqual(["a", "b"]);
    expect(read?.entries[0].threadId).toBe("thread:1");
  });
});

describe("the cursor", () => {
  const hints = [hint(0, "answer"), hint(5, "hold"), hint(9, "rest")];

  it("advances only over hints whose time has come", () => {
    expect(hintsDueThrough(hints, 0, -1)).toBe(0);
    expect(hintsDueThrough(hints, 0, 0)).toBe(1);
    expect(hintsDueThrough(hints, 1, 4.99)).toBe(1);
    expect(hintsDueThrough(hints, 1, 5)).toBe(2);
    expect(hintsDueThrough(hints, 0, 1000)).toBe(3);
  });

  it("never runs backwards", () => {
    expect(hintsDueThrough(hints, 3, 0)).toBe(3);
  });
});

describe("focus", () => {
  it("has no axis unless exactly two beads were placed", () => {
    expect(focusFrom([BEADS.a]).axis).toBeNull();
    expect(focusFrom([BEADS.a, BEADS.b, BEADS.c]).axis).toBeNull();
    expect(focusFrom([BEADS.a, BEADS.c]).axis).not.toBeNull();
  });

  it("measures the spread from the centroid, not from the arena's centre", () => {
    const focus = focusFrom([BEADS.a, BEADS.c]);
    expect(focus.centre).toEqual(ORIGIN);
    expect(focus.spread).toBeCloseTo(3, 6);
  });
});

/* ────────────────────────────────────────────────────────────────────── *
 * The two components actually claim it.
 *
 * Stated against the source rather than by calling it: importing either pulls
 * the renderer, the post-processing stack and a GPU probe into a node suite —
 * see `cameraHold.test.ts` for the measurement. These two are the guard on the
 * blocker itself, which was not a wrong law but an absent consumer.
 * ────────────────────────────────────────────────────────────────────── */

const source = (name: string): string =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

describe("the scene claims the conclusion", () => {
  it("subscribes the camera rig to the conclusion cue and executes the hints", () => {
    const rig = source("CameraRig.tsx");
    expect(rig).toMatch(/cueBus\.subscribe\(\s*"camera"/);
    expect(rig).toMatch(/conclusion\.perform/);
    expect(rig).toMatch(/beginConclusionPerformance\(/);
    expect(rig).toMatch(/conclusionCamera\.current\.advance\(/);
    // And the player can always take it back.
    expect(rig).toMatch(/conclusionCamera\.current\.interrupt\(\)/);
  });

  it("gives the strands their compiled times", () => {
    const threads = source("Threads.tsx");
    expect(threads).toMatch(/threadLightingTimes\(/);
    expect(threads).toMatch(/litAtSeconds=\{/);
    expect(threads).toMatch(/performanceStartedAtMs=\{/);
  });
});
