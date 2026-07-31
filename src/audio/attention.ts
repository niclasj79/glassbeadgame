/**
 * ATTENTION SOUND-SPACE — the score leaves room (VERTICAL-SLICE-SPEC §6).
 *
 * The specification asks for one thing here, and it is a subtraction: "audio
 * leaves space through reduced density or call-and-response". Attention is not
 * an effect layered on top of the piece; it is the piece getting out of the way
 * so one idea can be heard.
 *
 * Two ways of getting out of the way, chosen by how busy the web already is:
 *
 *  - **Reduced density** while the web is thin. Fewer thread voices speak, the
 *    bed recedes, and the attended motif is simply the loudest thing.
 *  - **Call-and-response** once several threads are sounding. Thinning alone
 *    stops working when the texture is continuous — you cannot make a crowded
 *    room quieter by asking fewer people to talk at the same volume. So the
 *    score alternates: the attended motif states itself, then everything holds
 *    an actual silence for the candidates to answer into.
 *
 * The attended concept's own motif foregrounds in both. It is never re-voiced,
 * transposed, or prettified — a player learning a bead by ear must hear the same
 * figure under attention that they hear in the texture, only clearer.
 *
 * Pure. No Web Audio, no browser, no React.
 */
import { NEUTRAL_PHRASING, motifSpanSeconds, renderMotif, type AudioPhrasing, type MotifSource } from "./motif";
import { type WorldMode } from "./mode";
import { makeVoicePlan, type PlannedNote, type VoicePlan } from "./plan";
import { SCORE } from "./score";

export const ATTENTION_SPACE_MODES = Object.freeze([
  "reduced-density",
  "call-and-response",
] as const);
export type AttentionSpaceMode = (typeof ATTENTION_SPACE_MODES)[number];

export interface AttentionSpaceInput {
  readonly planId: string;
  readonly mode: WorldMode;
  readonly attended: MotifSource;
  readonly unitSeconds: number;
  readonly ambientGain: number;
  /** Thread voices currently able to speak. Decides which kind of space to open. */
  readonly activeThreadCount: number;
  readonly phrasing?: AudioPhrasing;
}

/**
 * What the score should do while a bead is attended. `densityScale` and
 * `bedGainScale` are multipliers the ambient engine applies to its own
 * probabilities and levels — attention does not reach into the ambient engine's
 * decisions, it changes the space those decisions are made in.
 */
export interface AttentionSpacePlan {
  readonly spaceMode: AttentionSpaceMode;
  readonly densityScale: number;
  readonly bedGainScale: number;
  /** Silence deliberately held open after each statement. */
  readonly responseGapSeconds: number;
  readonly foreground: VoicePlan;
  readonly cycleSeconds: number;
}

/** The neutral space. Applied when attention is released. */
export const ATTENTION_RELEASED: Readonly<{
  densityScale: number;
  bedGainScale: number;
}> = Object.freeze({ densityScale: 1, bedGainScale: 1 });

export function planAttentionSpace(
  input: AttentionSpaceInput
): AttentionSpacePlan {
  if (input.unitSeconds <= 0) {
    throw new RangeError("a rhythmic unit must be a positive number of seconds");
  }
  const phrasing = input.phrasing ?? NEUTRAL_PHRASING;
  const spaceMode: AttentionSpaceMode =
    input.activeThreadCount >= SCORE.attention.callAndResponseThreads
      ? "call-and-response"
      : "reduced-density";

  const densityScale =
    spaceMode === "call-and-response"
      ? SCORE.attention.responseDensityScale
      : SCORE.attention.thinDensityScale;

  const span = motifSpanSeconds(input.attended.motif, input.unitSeconds, phrasing);
  const gap =
    spaceMode === "call-and-response" ? SCORE.attention.responseGapSeconds : 0;

  const notes: PlannedNote[] = [];
  for (let repeat = 0; repeat < SCORE.attention.repeats; repeat++) {
    notes.push(
      ...renderMotif(input.attended, {
        mode: input.mode,
        at: repeat * (span + gap),
        unitSeconds: input.unitSeconds,
        // Foreground means louder than the bed it is heard against — that
        // relationship, not an absolute, is what "foreground" can mean.
        gain: input.ambientGain * SCORE.attention.foregroundGain,
        role: "subject",
        idPrefix: `${input.planId}:attend:${repeat}`,
        phrasing,
      })
    );
  }

  const foreground = makeVoicePlan({
    id: `${input.planId}:attention`,
    kind: "attention",
    intention: null,
    notes,
    meta: {
      conceptIds: [input.attended.conceptId],
      grammar: spaceMode,
      // Attention asserts nothing and therefore never closes anything.
      resolves: false,
      interval: null,
      beatingHz: null,
    },
  });

  return Object.freeze({
    spaceMode,
    densityScale,
    bedGainScale: SCORE.attention.bedGainScale,
    responseGapSeconds: gap,
    foreground,
    cycleSeconds: Number(
      (SCORE.attention.repeats * (span + gap)).toFixed(4)
    ),
  });
}
