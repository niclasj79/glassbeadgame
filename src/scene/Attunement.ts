import type { RelationIntention } from "@/domain/events";

/**
 * ATTUNEMENT, IN THE WORLD (VERTICAL-SLICE-SPEC §13).
 *
 * "Threads become individually audible; relation channels shimmer according to
 * their grammar; no new intellectual assertions are generated."
 *
 * The audio half has been implemented literally for a while (`audio/attunement.
 * ts`). The world's half had not: entering Attunement thinned time and nothing
 * else, so a screenshot of the held state was indistinguishable from a
 * screenshot of ordinary play. A held heightened state that cannot be seen is
 * not a state.
 *
 * This module is the pure part of the fix, so "does a Tension's channel ever
 * arrive?" is a unit test rather than a screenshot argument. It owns no Three,
 * no React and no clock.
 *
 * Two rules govern everything below.
 *
 *  - **Construction, not brightness.** Every intention gets the SAME light
 *    budget and the same envelope; what differs is where the light *goes*. The
 *    ribbon's own fragment shader already refuses to modulate a settled Tension
 *    dimmer than an Echo, for the reason stated there: a player who sees one
 *    intention fade learns it is worth less. The same refusal applies here.
 *  - **Nothing new is asserted.** The travel of a channel restates the grammar
 *    the player already declared — an Echo arrives from both ends, a Passage
 *    goes one way, a Tension never lands, a Ground settles. No relation, facet
 *    or claim is invented by looking.
 */

/** The floor an unspoken thread recedes to while another one is speaking. */
export const ATTUNED_THREAD_FLOOR = 0.3;

/**
 * How fast a thread rises into, or recedes from, its turn. Seconds. Slow enough
 * that the transition reads as attention moving rather than as a switch, and far
 * below any rate CAV-007 concerns itself with.
 */
export const ATTUNED_EASE_SECONDS = 0.55;

/**
 * How long the held state persists after a channel stops arriving.
 *
 * Attunement's channels have real silence between them — that is the point of
 * "individually audible". Without a hold the whole web would swell back to full
 * presence in every gap and recede again on every entry, which is a flicker
 * rather than a state. It also matters for the case where nothing is sounding
 * at all: a player whose audio context has never been unlocked must not have
 * their composition quietly dimmed by a queue that is not running.
 */
export const ATTUNED_HOLD_SECONDS = 6;

export interface VoiceTravel {
  /**
   * Where the light is, along the thread's arc, in 0..1 from source to target.
   * One position for a one-directional grammar, two for a mirrored one.
   */
  readonly positions: readonly number[];
  /** The shared envelope: 0 at the edges of the voice's span, 1 in the middle. */
  readonly strength: number;
}

const EMPTY: VoiceTravel = Object.freeze({
  positions: Object.freeze([]),
  strength: 0,
});

/**
 * Where a relation's light is while its own voice is sounding.
 *
 * `progress` is 0 at the first note of the channel and 1 where it stops
 * arriving. Outside that the thread is not speaking and there is no light —
 * silence, rather than a light parked at an end.
 */
export function voiceTravel(
  intention: RelationIntention,
  progress: number
): VoiceTravel {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) return EMPTY;

  // One envelope for all four. See the note above: the grammar changes the
  // path, never the payment.
  const strength = Math.sin(Math.PI * progress);

  switch (intention) {
    case "echo":
      // Imitation: the figure arrives from both ends at once and meets in the
      // middle, exactly as the ribbon's own growth coordinate does.
      return Object.freeze({
        positions: Object.freeze([progress * 0.5, 1 - progress * 0.5]),
        strength,
      });
    case "passage":
      // One way only, source to destination.
      return Object.freeze({
        positions: Object.freeze([progress]),
        strength,
      });
    case "tension":
      // It never arrives. The light works about the middle and is still working
      // when the channel ends — which is the whole of what a Tension says.
      return Object.freeze({
        positions: Object.freeze([
          0.5 + 0.24 * Math.sin(Math.PI * 2 * 1.2 * progress),
        ]),
        strength,
      });
    case "ground":
      // It settles: it reaches the supported end early and stays seated there.
      return Object.freeze({
        positions: Object.freeze([Math.min(1, progress * 2)]),
        strength,
      });
  }
}

/**
 * The same travel, read from the other end.
 *
 * The ambient choir alternates which of a thread's two beads speaks first —
 * `frameState.pulses` has carried that as `flip` since the choir was written,
 * and nothing has ever read it. The light walks from the bead that is actually
 * sounding first, so the picture and the phrase agree about direction. An Echo
 * is symmetric and is unchanged by this, which is correct: an imitation reads
 * the same reversed.
 */
export function mirrorTravel(travel: VoiceTravel): VoiceTravel {
  return Object.freeze({
    positions: Object.freeze(travel.positions.map((at) => 1 - at)),
    strength: travel.strength,
  });
}

/**
 * How present a thread is right now.
 *
 * Outside Attunement every thread is fully present — the ordinary web is not a
 * queue and nothing recedes. Inside it, the thread whose voice is sounding is
 * at full presence and the others recede to a floor. They never disappear: the
 * composition is still there, and a thread that vanished while another spoke
 * would be a claim about which relation matters.
 *
 * `cycleRunning` is the third condition and it is not a detail. If no channel is
 * sounding — a context that was never unlocked, a session with nothing woven —
 * then nothing recedes, because there is nothing for it to recede *behind*.
 * Dimming a composition to make room for a silence would be the world lying
 * about what it is doing.
 */
export function attunedPresence(
  attuned: boolean,
  cycleRunning: boolean,
  speaking: boolean
): number {
  if (!attuned || !cycleRunning) return 1;
  return speaking ? 1 : ATTUNED_THREAD_FLOOR;
}
