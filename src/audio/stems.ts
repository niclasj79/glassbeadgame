/**
 * THE STEMS — the web, heard growing (ADR-017).
 *
 * A faculty's stem enters when its first thread is woven and thickens with its
 * threads, up to three voices: Measure an arpeggio in metal and glass on the
 * eighths, Sound a formant sustain, Matter a low pedal in gut, Image air in
 * reed. Each is pitched from the chord the bed is on, and each is the
 * harmony's movement, never melody: no stem ever sounds a concept's identity
 * note in the concept's register, so none can state a concept's motif, which
 * always begins there.
 *
 * `stemPlan` is pure and speaks in the grid's units — onsets in sixteenths of
 * the slot, envelopes in slots — so the grid, the ceilings and the pitches are
 * provable without a clock. `playStems` is the body that puts a slot of stems
 * on the ambient bus, so reach, space and the conclusion's fade take them as
 * they take the bed. The module is fetched when the bed starts (`ambient.ts`),
 * after the title, and never with the first load.
 *
 * Every note ends inside its own slot (Matter's inside its pair of slots), so
 * no stem sounds across a phrase boundary, where the chord turns.
 */
import { CASTALIA_CONCEPTS } from "@/content/castalia";
import {
  FACULTY_IDS,
  type FacultyId,
  type MotifRegister,
  type TimbreId,
} from "@/content/castalia/schema";
import { hashString, mulberry32 } from "@/lib/utils";
import { COMFORT } from "./comfort";
import type { Chord } from "./harmony";
import { pitchClass } from "./mode";
import { beadVoice, modeFreq } from "./theory";
import { playNote, voiceBudget } from "./voices";

/**
 * No stem note is louder than this, as a multiple of the bed's scale: under
 * the choir, whose first note peaks at 0.075.
 */
export const STEM_CEILING = 0.05;

/** Each stem's level for one voice, before the bed's scale; its voices share it. */
export const STEM_GAIN: Readonly<Record<FacultyId, number>> = Object.freeze({
  measure: 0.024, // metal and glass are bright, and the arpeggio is busy
  sound: 0.032,
  matter: 0.04, // a pedal in the sub register needs level to be heard at all
  image: 0.02, // the reed brings its own breath
});

/** A stem thickens with its faculty's threads up to this many voices. */
export const STEM_MAX_VOICES = 3;

/**
 * Texture gives way to meaning: the stems claim voices only while this many of
 * the global budget stay free — half of it. The budget counts a note from the
 * moment it is scheduled, the stems are scheduled before the choir in each
 * slot, and a relation the director plays claims ten to twelve voices at once;
 * the reserve is what keeps those whole. In the busiest passages the stems
 * thin first (`playStems`).
 */
export const STEM_VOICE_RESERVE = 24;

/** How one faculty's stem is played. */
export interface StemBody {
  /** The body of each onset, in turn. */
  readonly timbres: readonly TimbreId[];
  readonly register: MotifRegister;
  /**
   * The chord tone the stem stands on — 0 the root, 1 the fifth, 2 the colour
   * — or null for the arpeggio, which walks them all.
   */
  readonly tone: 0 | 1 | 2 | null;
  /** Slots one statement spans: Matter's pedal speaks every other slot. */
  readonly spanSlots: 1 | 2;
  /** Onsets within the statement, in sixteenths of the slot. */
  readonly onsets: readonly number[];
  /** Every note's envelope, in slots. A note ends inside its statement. */
  readonly attack: number;
  readonly hold: number;
  readonly release: number;
}

const STEMS: Readonly<Record<FacultyId, StemBody>> = Object.freeze({
  // An arpeggio on the eighths, four notes a slot, each gone as the next
  // arrives: rising on even slots, falling on odd ones.
  measure: {
    timbres: ["metal", "glass"],
    register: "mid",
    tone: null,
    spanSlots: 1,
    onsets: [0, 4, 8, 12],
    attack: 0.004,
    hold: 0.02,
    release: 0.226,
  },
  // A formant sustain on the colour, swelling through the slot.
  sound: {
    timbres: ["voice"],
    register: "mid",
    tone: 2,
    spanSlots: 1,
    onsets: [0],
    attack: 0.3,
    hold: 0.4,
    release: 0.3,
  },
  // A pedal on the root under the drone, one to every two slots.
  matter: {
    timbres: ["gut"],
    register: "sub",
    tone: 0,
    spanSlots: 2,
    onsets: [0],
    attack: 0.25,
    hold: 1.25,
    release: 0.5,
  },
  // Air on the fifth, arriving on the second eighth.
  image: {
    timbres: ["reed"],
    register: "high",
    tone: 1,
    spanSlots: 1,
    onsets: [2],
    attack: 0.3,
    hold: 0.275,
    release: 0.3,
  },
});

/** How a faculty's stem is played: its bodies, register, rhythm and envelope. */
export function stemFor(faculty: FacultyId): StemBody {
  return STEMS[faculty];
}

/** Every concept's identity note as it sounds in the concept's own register. */
const IDENTITY_HZ: readonly number[] = Object.freeze(
  CASTALIA_CONCEPTS.flatMap((concept) => {
    const voice = beadVoice(concept.id);
    return voice === null ? [] : [voice.freq];
  })
);

/** Whether a pitch is some concept's identity note in its own register, within a cent. */
export function isIdentityPitch(hz: number): boolean {
  return IDENTITY_HZ.some((identity) => Math.abs(1200 * Math.log2(hz / identity)) < 1);
}

const free = (degree: number, register: MotifRegister): boolean =>
  !isIdentityPitch(modeFreq(degree, register));

/** The chord's tones from `from` upward in a register, never an identity note. */
function freeTones(
  chord: Chord,
  register: MotifRegister,
  from: number,
  count: number
): number[] {
  const tones: number[] = [];
  for (let degree = from; tones.length < count && degree < from + 48; degree += 1) {
    if (chord.includes(pitchClass(degree)) && free(degree, register)) tones.push(degree);
  }
  return tones;
}

/**
 * A standing stem's voices, low to high. First, the chord tone it stands on in
 * its register's octave — or where that is a concept's identity note, the
 * chord's next tone in turn (root, fifth, colour), in the same octave. At a
 * second thread, the next free chord tone above it; at a third, the octave
 * above it, or where that octave is an identity note, the next free chord tone
 * above the second voice.
 */
function standingVoices(
  chord: Chord,
  register: MotifRegister,
  tone: 0 | 1 | 2,
  voices: number
): number[] {
  let base: number | null = null;
  for (let turn = 0; turn < 3 && base === null; turn += 1) {
    const degree = chord[(tone + turn) % 3];
    if (free(degree, register)) base = degree;
  }
  if (base === null) return [];
  const above = freeTones(chord, register, base + 1, 2);
  const octave = base + 12;
  const third = above[0] === octave || !free(octave, register) ? above[1] : octave;
  return [base, above[0], third].slice(0, voices).filter((d) => d !== undefined);
}

/** One note of a stem, in the grid's units. */
export interface StemNote {
  readonly faculty: FacultyId;
  readonly timbre: TimbreId;
  readonly register: MotifRegister;
  /** Degree in the register, as `modeFreq` reads it. */
  readonly degree: number;
  readonly frequency: number;
  /** Onset within the slot, in sixteenths: always a whole number. */
  readonly sixteenth: number;
  /** Peak level, before the bed's scale. */
  readonly gain: number;
  /** Envelope, in slots. */
  readonly attack: number;
  readonly hold: number;
  readonly release: number;
}

/**
 * The degrees of each onset of Measure's arpeggio: the chord's first four free
 * tones from the bottom of its register, rising on even slots and falling on
 * odd ones; the voices beyond the first are the next free tones above the
 * arpeggio, added on the downbeat, so it thickens without striking a tone
 * twice in a slot.
 */
function arpeggio(chord: Chord, body: StemBody, voices: number, slot: number): number[][] {
  const steps = body.onsets.length;
  const line = freeTones(chord, body.register, 0, steps + voices - 1);
  const walk = line.slice(0, steps);
  if (slot % 2 !== 0) walk.reverse();
  return walk.map((degree, onset) =>
    onset === 0 ? [degree, ...line.slice(steps, steps + voices - 1)] : [degree]
  );
}

/**
 * THE NOTES OF ONE STEM IN ONE SLOT.
 *
 * `threadCount` is the faculty's woven threads: none is silence, and each
 * thread up to three adds a voice — to Measure's arpeggio a chord tone above it
 * on the downbeat, to a standing stem a chord tone and then an octave (see
 * `standingVoices`). The voices share the stem's level, so a stem thickens
 * rather than grows loud. Pure: a function of its arguments.
 */
export function stemPlan(
  faculty: FacultyId,
  chord: Chord,
  threadCount: number,
  slotIndex: number
): readonly StemNote[] {
  const body = STEMS[faculty];
  const voices = Math.min(STEM_MAX_VOICES, Math.max(0, Math.floor(threadCount)));
  const slot = Math.floor(slotIndex);
  if (voices === 0 || slot % body.spanSlots !== 0) return [];
  const gain = STEM_GAIN[faculty] / Math.sqrt(voices);
  const tone = body.tone;
  const onsets =
    tone === null
      ? arpeggio(chord, body, voices, slot)
      : body.onsets.map(() => standingVoices(chord, body.register, tone, voices));
  const notes: StemNote[] = [];
  body.onsets.forEach((sixteenth, onset) => {
    const timbre = body.timbres[onset % body.timbres.length];
    for (const degree of onsets[onset] ?? []) {
      notes.push(
        Object.freeze({
          faculty,
          timbre,
          register: body.register,
          degree,
          frequency: modeFreq(degree, body.register),
          sixteenth,
          gain,
          attack: body.attack,
          hold: body.hold,
          release: body.release,
        })
      );
    }
  });
  return Object.freeze(notes);
}

/**
 * Whether a faculty's stem speaks in a slot under `setSpace`'s density: always
 * in ordinary play, otherwise on a coin weighted by the density as the choir's
 * voices are — a coin that is a pure function of the faculty and the slot, so a
 * session thins the same way every time it is played.
 */
export function stemSpeaks(faculty: FacultyId, slot: number, density: number): boolean {
  if (density >= 1) return true;
  if (density <= 0) return false;
  return mulberry32(hashString(`stem:${faculty}:${slot}`))() < density;
}

/** One slot of the bed, as the stems need it. */
export interface StemSlot {
  readonly chord: Chord;
  readonly slot: number;
  /** The slot's first moment, on the audio clock. */
  readonly at: number;
  readonly slotSeconds: number;
  /** `setSpace`'s density and bed multipliers. */
  readonly density: number;
  readonly bed: number;
  /** The woven threads seated in each faculty. */
  readonly threads: ReadonlyMap<FacultyId, ReadonlySet<string>>;
}

/**
 * Put one slot of the stems on `bus`: every faculty with a woven thread, thinned
 * by the density, inside the stems' part of the voice budget.
 *
 * Voices are handed out a round at a time — every speaking stem's first voice,
 * in the pack's order, before any stem's second — and a stem whose next voice
 * does not fit is passed over while the others are served. So a full budget
 * thins the stems before it silences any, and the cheaper lines keep playing.
 * Returns the notes sounded.
 */
export function playStems(ctx: AudioContext, bus: AudioNode, request: StemSlot): number {
  const sixteenth = request.slotSeconds / 16;
  let room =
    COMFORT.voice.maxConcurrent - STEM_VOICE_RESERVE - voiceBudget.active(ctx.currentTime);
  const speaking = FACULTY_IDS.filter(
    (faculty) =>
      (request.threads.get(faculty)?.size ?? 0) > 0 &&
      stemSpeaks(faculty, request.slot, request.density)
  );
  const granted = new Map<FacultyId, readonly StemNote[]>();
  for (let voices = 1; voices <= STEM_MAX_VOICES; voices += 1) {
    for (const faculty of speaking) {
      const held = granted.get(faculty);
      if ((request.threads.get(faculty)?.size ?? 0) < voices) continue;
      if (voices === 1 ? held !== undefined : held === undefined) continue;
      const notes = stemPlan(faculty, request.chord, voices, request.slot);
      const cost = notes.length - (held?.length ?? 0);
      if (notes.length === 0 || cost > room) continue;
      granted.set(faculty, notes);
      room -= cost;
    }
  }
  let sounded = 0;
  for (const [faculty, notes] of granted) {
    notes.forEach((note, index) => {
      const played = playNote(ctx, bus, note.timbre, note.frequency, {
        gain: note.gain * request.bed,
        at: request.at + note.sixteenth * sixteenth,
        attack: note.attack * request.slotSeconds,
        hold: note.hold * request.slotSeconds,
        release: note.release * request.slotSeconds,
        seed: `stem:${faculty}:${request.slot}:${index}`,
      });
      if (played) sounded += 1;
    });
  }
  return sounded;
}
