/**
 * THE SCENE DIRECTOR — the world's half of ADR-009.
 *
 * Every cue plan declares `channels`, and until this existed the `scene`,
 * `camera` and `haptics` channels had no subscriber at all: three of the four
 * loop moments were planned, published and dropped on the floor. The visible
 * consequence was precise and embarrassing — `frameState.flare` was decayed
 * every frame by `Firmament` and never once raised, `frameState.kick` was
 * decayed every frame by `CameraRig` and never once raised, and `emitBurst`,
 * which exists to feed the one pooled particle system in the game, had zero
 * callers. The world could not answer, because nothing was listening.
 *
 * This module is pure. It receives a cue and calls a seam; it owns no Three,
 * no React, no `frameState`, and no clock. That is what makes "does a
 * documented relation flare the sky exactly as much as an Open Thread" a unit
 * test rather than a screenshot argument.
 *
 * ── One director, one handler per channel ───────────────────────────────────
 * `handleScene` and `handleCamera` are separate entry points *because the bus
 * dispatches per channel*. A single handler subscribed to both would answer
 * every cue twice, and a `camera` channel that is declared by every plan and
 * subscribed by nobody is worse than one that does not exist — it is a contract
 * advertising a director that never ran. The split is the whole point: light
 * belongs to the scene, impact belongs to the camera, and each arrives because
 * its own channel was declared.
 *
 * ── The one rule that governs the numbers below (CAV-006) ───────────────────
 * Documented, Open Thread and Unresolved get the SAME flare and the SAME
 * quantity of particles — identically, with no branch between them. They are
 * different states of knowledge, not better and worse results, so the world
 * must not pay one of them more.
 *
 * The director deliberately draws no distinction of its own here. The arena
 * already carries it, in the one place where it has been *solved* rather than
 * asserted: `scene/resolution.ts` gives a documented relation dry ink with a
 * closing contour and an Open Thread wet ink that stops short, with the extra
 * coverage of the spread balanced against the coverage the unclosed terminal
 * gives up, so the two lay down the same quantity of ink at the same peak
 * strength. Anything added on top of that — a second arc, an extra glow, one
 * more particle — would re-introduce exactly the reward gradient that module
 * exists to remove.
 */
import type { PresentationCue } from "../cues";

/**
 * The seam the world is written through.
 *
 * Deliberately semantic: the director names concepts and amounts, never
 * positions, colours or materials. Where a bead *is* belongs to the scene, and
 * a director that knew would be a second layout engine.
 */
export interface SceneStage {
  /** Raise the starfield's answer. 0..1, additive, clamped by the stage. */
  readonly flare: (amount: number) => void;
  /** A camera impact. 0..1, additive, clamped by the stage. */
  readonly kick: (amount: number) => void;
  /** Spawn particles at a concept's current position. Unknown ids are a no-op. */
  readonly burst: (conceptId: string, count: number, speed: number) => void;
  /** Enter or leave the held, slowed state of Attunement. */
  readonly setAttuned: (active: boolean) => void;
  /**
   * The player is composing. Keyboard play never touches the pointer layer, so
   * without this the camera drifts into its idle wander while someone is
   * actively working — the world behaving as though the room were empty.
   */
  readonly touch: () => void;
}

export interface SceneDirector {
  /** The `scene` channel: light, particles, held time, presence. */
  readonly handleScene: (cue: PresentationCue) => void;
  /** The `camera` channel: impact, and nothing else. */
  readonly handleCamera: (cue: PresentationCue) => void;
}

/**
 * Response amplitudes, in one table so the CAV-006 equalities above are
 * readable as equalities rather than as three numbers that happen to match.
 */
const RESPONSE = Object.freeze({
  /** Arming changes the attended bead immediately (spec §8, I-012). */
  arm: Object.freeze({ kick: 0.1, count: 6, speed: 0.5 }),
  /** The candidate is caught. Small, but unmistakably not a hover. */
  latch: Object.freeze({ kick: 0.12, count: 5, speed: 0.55 }),
  /** The weave lands. The impact, before any meaning has resolved. */
  woven: Object.freeze({ kick: 0.22, count: 8, speed: 0.9 }),
  /** Every outcome, identically. See the CAV-006 note above. */
  outcome: Object.freeze({ flare: 0.55, count: 14, speed: 1.15 }),
  /** A motif is structural: the whole web has said something. */
  motif: Object.freeze({ flare: 0.85, kick: 0.3, count: 10, speed: 1 }),
  attunementEnter: 0.7,
  attunementExit: 0.25,
  conclusion: Object.freeze({ flare: 1, kick: 0.4 }),
});

export function createSceneDirector(stage: SceneStage): SceneDirector {
  const outcome = (a: string, b: string): void => {
    stage.flare(RESPONSE.outcome.flare);
    stage.burst(a, RESPONSE.outcome.count, RESPONSE.outcome.speed);
    stage.burst(b, RESPONSE.outcome.count, RESPONSE.outcome.speed);
  };

  const handleScene = (cue: PresentationCue): void => {
    switch (cue.type) {
      case "attention.enter":
      case "attention.clear":
        // Attention opens space; the world answers by holding still and
        // staying awake, not by flashing at a bead the player just looked at.
        stage.touch();
        break;

      case "intention.armed": {
        stage.touch();
        stage.burst(
          String(cue.payload.conceptId),
          RESPONSE.arm.count,
          RESPONSE.arm.speed
        );
        break;
      }

      case "candidate.latched": {
        stage.touch();
        stage.burst(
          String(cue.payload.pair[1]),
          RESPONSE.latch.count,
          RESPONSE.latch.speed
        );
        break;
      }

      case "weave.released":
      case "thread.woven": {
        stage.touch();
        stage.burst(
          String(cue.payload.pair[0]),
          RESPONSE.woven.count,
          RESPONSE.woven.speed
        );
        stage.burst(
          String(cue.payload.pair[1]),
          RESPONSE.woven.count,
          RESPONSE.woven.speed
        );
        break;
      }

      // One branch for all three on purpose. See the CAV-006 note above: the
      // epistemic distinction is drawn by the ribbon's own material, not paid
      // for here.
      case "outcome.documented":
      case "outcome.open-thread":
      case "outcome.unresolved":
        outcome(String(cue.payload.pair[0]), String(cue.payload.pair[1]));
        break;

      case "motif.completed": {
        stage.flare(RESPONSE.motif.flare);
        for (const conceptId of cue.payload.conceptIds) {
          stage.burst(
            String(conceptId),
            RESPONSE.motif.count,
            RESPONSE.motif.speed
          );
        }
        break;
      }

      case "attunement.changed":
        stage.setAttuned(cue.payload.active);
        stage.flare(
          cue.payload.active
            ? RESPONSE.attunementEnter
            : RESPONSE.attunementExit
        );
        break;

      case "conclusion.perform":
        stage.setAttuned(false);
        stage.flare(RESPONSE.conclusion.flare);
        break;

      default:
        break;
    }
  };

  /**
   * The `camera` channel. Impact only — every one of these numbers used to be
   * spent from the scene handler, which meant the channel every plan declares
   * had no subscriber and the camera answered by coincidence rather than by
   * contract.
   */
  const handleCamera = (cue: PresentationCue): void => {
    switch (cue.type) {
      case "intention.armed":
        stage.kick(RESPONSE.arm.kick);
        break;
      case "candidate.latched":
        stage.kick(RESPONSE.latch.kick);
        break;
      case "weave.released":
      case "thread.woven":
        stage.kick(RESPONSE.woven.kick);
        break;
      case "motif.completed":
        stage.kick(RESPONSE.motif.kick);
        break;
      case "conclusion.perform":
        stage.kick(RESPONSE.conclusion.kick);
        break;
      default:
        // Outcomes deliberately do not kick. CAV-006: the three epistemic
        // states must cost the camera exactly the same, and the cheapest way
        // to guarantee that is to spend nothing on any of them.
        break;
    }
  };

  return Object.freeze({ handleScene, handleCamera });
}
