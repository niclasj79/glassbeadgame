import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RELATION_INTENTIONS } from "@/domain/events";
import { toConceptId, toThreadId } from "@/domain/ids";
import {
  attendDraft,
  chooseDraftReading,
  createInterpretationDraft,
  deriveFocusView,
  lockDraftCandidate,
  type FocusViewInput,
  type InterpretationDraft,
} from "@/runtime/interactionDraft";
import { castalia } from "@/themes/worlds";
import { NEUTRAL_ARC_LIFT, arcMid, arcPoint, previewMidpoint } from "./curves";
import {
  CHOSEN_READING_OPACITY,
  HEARD_READING_OPACITY,
  SIGHTED_STRAND_OPACITY,
  UNREAD_PAIR_OPACITY,
  UNREAD_STRAND,
  createRibbonMaterial,
  previewStrandFor,
} from "./ribbon";
import { COMFORT, THREAD_FORMS, threadForm } from "./threadGrammar";

const source = (file: string): string =>
  readFileSync(new URL(`./${file}`, import.meta.url), "utf8");

/** Source with comments removed — prose about a uniform is not a use of it. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const material = (intention: (typeof RELATION_INTENTIONS)[number] | null, still: boolean) =>
  createRibbonMaterial({
    theme: castalia,
    form: intention === null ? null : threadForm(intention),
    ink: new THREE.Color("#ffffff"),
    width: 0.022,
    opacity: 0.9,
    reducedMotion: still,
  });

/**
 * VERTICAL-SLICE-SPEC §22 makes reduced motion a required, first-class path,
 * and CAV-007 says what it may and may not do: the reduced-motion route
 * expresses Tension "through pattern, phase text, and stereo width instead of
 * movement and glare — never by removing the Tension."
 *
 * Every shader written for the thread grammar ignored the preference
 * completely: the ribbon's sway, its travelling ticks, its chevrons and its
 * hatch all ran off `uTime` whatever the player had asked for. Reduced motion
 * has to reach the GPU, and it has to stop at travel and oscillation.
 */
describe("the thread ribbon honours reduced motion", () => {
  it("carries a motion uniform that the preference actually sets", () => {
    const still = material("tension", true);
    const moving = material("tension", false);
    expect(still.uniforms.uMotion.value).toBe(0);
    expect(moving.uniforms.uMotion.value).toBe(1);
    still.dispose();
    moving.dispose();
  });

  it("takes away the travel and nothing else", () => {
    for (const intention of [...RELATION_INTENTIONS, null]) {
      const still = material(intention, true);
      const moving = material(intention, false);
      for (const key of Object.keys(moving.uniforms)) {
        if (key === "uMotion") continue;
        expect(JSON.stringify(still.uniforms[key].value)).toBe(
          JSON.stringify(moving.uniforms[key].value)
        );
      }
      still.dispose();
      moving.dispose();
    }
  });

  it("keeps the Tension a Tension when it is standing still", () => {
    // Construction, bound and beat are untouched: with uMotion at 0 the sway
    // term becomes sin(t * 2.1) — a *static* counter-rotation that still
    // varies along the arc and still opposes between the two strands, at
    // CAV-007's amplitude. The relation is held, not removed.
    const still = material("tension", true);
    expect(still.uniforms.uStrands.value).toBe(2);
    expect(still.uniforms.uTorsion.value).toBeCloseTo(
      COMFORT.maxTorsionRadians,
      12
    );
    expect(still.uniforms.uBeat.value).toBeGreaterThan(0);
    expect(still.uniforms.uOpacity.value).toBe(0.9);
    still.dispose();

    const shader = code(source("ribbon.ts"));
    expect(shader).toContain(
      "float sway = uTorsion * uUnrest * sin(GBG_TAU * uBeat * aTime + t * 2.1) * aStrand;"
    );
    expect(shader).toContain("float angle = wind + sway;");
  });

  it("routes every animated expression in both shaders through the uniform", () => {
    const shader = code(source("ribbon.ts"));
    // Two shader stages, each aliasing the clock once…
    expect(shader.match(/float aTime = uTime \* uMotion;/g)).toHaveLength(2);
    // …and uTime appearing nowhere else: two `uniform` declarations, the two
    // aliases themselves, and the uniform's seed. Five, and no sixth.
    expect(shader.match(/uTime/g)).toHaveLength(5);
    // The marks are still drawn — they simply stop travelling.
    expect(shader).toMatch(/fract\(closure \* 5\.0 - aTime \* uTravel\)/);
    expect(shader).toMatch(/aTime \* uTravel \* 3\.0/);
    expect(shader).toMatch(/aTime \* 0\.16 \* slope/);
  });

  it("is wired from the player's preference, not from a constant", () => {
    expect(source("Threads.tsx")).toContain(
      "reducedMotion: profile.reducedMotion"
    );
  });

  it("never makes one relation intention dimmer than another", () => {
    // A settled Tension used to render ~22% dimmer than an Echo. That is the
    // "one kind pays better" failure CAV-006 forbids for outcomes, applied to
    // intentions instead: a player who watches Tension fade learns it is worth
    // less than the readings that stay bright. CAV-007's decay belongs to the
    // amplitude of the instability, which the vertex stage already carries.
    const source = readFileSync(new URL("./ribbon.ts", import.meta.url), "utf8");
    const fragment = source.slice(source.indexOf("uniform float uUnrest;", source.indexOf("uniform float uUnrest;") + 1));
    expect(fragment).not.toMatch(/alpha\s*\*=[^;]*uUnrest/);
  });
});

/**
 * THE UNREAD STRAND (I-016, I-017).
 *
 * A sighting and a locked pair nobody has read used to be drawn in Echo's
 * grammar as a placeholder — which showed every pair one reading's
 * construction, and its mirrored ticks, before the player had read anything.
 * The strand before a reading is its own construction, and every channel that
 * could carry a grammar is empty.
 */
describe("the unread strand", () => {
  it("is a construction of its own, after the four readings", () => {
    const unread = material(null, false);
    expect(unread.uniforms.uForm.value).toBe(UNREAD_STRAND.code);
    for (const form of THREAD_FORMS) expect(form.code).not.toBe(UNREAD_STRAND.code);
    expect(unread.name).toBe("castalia.thread.unread");
    unread.dispose();
  });

  it("carries no grammar on any channel: one strand, no torsion, no beat, no travel", () => {
    const unread = material(null, false);
    expect(unread.uniforms.uStrands.value).toBe(1);
    expect(unread.uniforms.uTorsion.value).toBe(0);
    expect(unread.uniforms.uBeat.value).toBe(0);
    expect(unread.uniforms.uTravel.value).toBe(0);
    unread.dispose();

    const shader = code(source("ribbon.ts"));
    // The fragment branch lays down no mark at all …
    const branch = /if \(form == 4\) \{([^}]*)\}/g;
    const branches = [...shader.matchAll(branch)].map((match) => match[1]);
    expect(branches).toHaveLength(2);
    expect(branches[1]).not.toMatch(/mark\s*=/);
    // … the vertex branch neither offsets, twists nor tapers toward an end …
    expect(branches[0]).not.toMatch(/offset|twist|mix\(/);
    // … and it privileges neither bead: it stays open where they would meet.
    expect(shader).toContain("float mirrored = (form == 0 || form == 2 || form == 4) ? 1.0 : 0.0;");
  });

  it("bows over the surface on an arc of its own", () => {
    const lifts = THREAD_FORMS.map((form) => form.arcLift);
    expect(lifts).not.toContain(NEUTRAL_ARC_LIFT);
    expect(NEUTRAL_ARC_LIFT).toBeGreaterThan(1);
  });

  it("anchors the sigils halfway along itself, whatever reading is heard", () => {
    const start = new THREE.Vector3(-2, -1, 3);
    const end = new THREE.Vector3(2.5, 1.5, 2);
    const anchor = previewMidpoint(start, end, new THREE.Vector3());
    const mid = arcMid(start, end, new THREE.Vector3(), NEUTRAL_ARC_LIFT);
    expect(anchor.distanceTo(arcPoint(start, mid, end, 0.5, new THREE.Vector3()))).toBeLessThan(1e-9);
    // The same point for the same pair, every time it is asked.
    expect(previewMidpoint(start, end, new THREE.Vector3()).equals(anchor)).toBe(true);
  });
});

/**
 * Which strand the focus view shows, and in which grammar. The chooser is
 * pure, and reads the one derivation every surface reads.
 */
describe("the preview strand", () => {
  const A = toConceptId("measure.fibonacci-sequence");
  const B = toConceptId("sound.counterpoint");
  const C = toConceptId("measure.prime-numbers");
  const IDS = Object.freeze([A, B, C]);
  const attending = attendDraft(createInterpretationDraft(), A, IDS);
  const locked = lockDraftCandidate(attending, B, IDS);
  const reading = chooseDraftReading(locked, "tension");

  const view = (draft: InterpretationDraft, overrides: Partial<FocusViewInput> = {}) =>
    deriveFocusView({
      draft,
      sightedConceptId: null,
      dwellConceptId: null,
      previewIntention: null,
      reopened: null,
      holding: false,
      profile: { reducedMotion: false, qualityTier: "base" },
      ...overrides,
    });

  it("draws nothing while roaming, or while attending with nothing sighted", () => {
    expect(previewStrandFor(view(createInterpretationDraft()), false)).toBeNull();
    expect(previewStrandFor(view(attending), false)).toBeNull();
  });

  it("draws the unread strand, faint, to a sighted bead", () => {
    expect(
      previewStrandFor(view(attending, { sightedConceptId: C }), false)
    ).toEqual({
      sourceId: String(A),
      targetId: String(C),
      intention: null,
      opacity: SIGHTED_STRAND_OPACITY,
    });
  });

  it("keeps the strand unread between a locked pair until a reading is heard", () => {
    expect(previewStrandFor(view(locked), false)).toEqual({
      sourceId: String(A),
      targetId: String(B),
      intention: null,
      opacity: UNREAD_PAIR_OPACITY,
    });
  });

  it("draws a heard reading's grammar, and a chosen one more firmly", () => {
    expect(
      previewStrandFor(view(locked, { previewIntention: "ground" }), false)
    ).toMatchObject({ intention: "ground", opacity: HEARD_READING_OPACITY });
    expect(previewStrandFor(view(reading), true)).toMatchObject({
      intention: "tension",
      opacity: CHOSEN_READING_OPACITY,
    });
    // The strand before a reading is always the faintest thing a pair wears.
    expect(SIGHTED_STRAND_OPACITY).toBeLessThan(UNREAD_PAIR_OPACITY);
    expect(UNREAD_PAIR_OPACITY).toBeLessThan(HEARD_READING_OPACITY);
    expect(HEARD_READING_OPACITY).toBeLessThan(CHOSEN_READING_OPACITY);
  });

  it("draws no preview over a reopened thread, which is already drawn", () => {
    expect(
      previewStrandFor(
        view(createInterpretationDraft(), {
          reopened: { threadId: toThreadId("thread-1"), pair: [A, B] },
        }),
        false
      )
    ).toBeNull();
  });
});
