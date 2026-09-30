/**
 * A PLAN'S NOTES, ON THE SCORE THE SCENE READS (ADR-016).
 *
 * The director writes every plan down before it sounds. That is what lets the
 * conductor know which bead a note belongs to without listening to anything:
 * each note that speaks for a concept is handed over as an onset, at the moment
 * it will sound, for as long as its envelope lasts, weighted by its role.
 *
 * The weight is the role's and nothing else's. A plan's `meta.outcome` is never
 * read here, so a documented relation, an Open Thread and an unresolved outcome
 * light their beads alike (CAV-006): outcomes differ in resolution, never in
 * reward, and light is a reward if it can be earned.
 *
 * Pure: no Web Audio, no clock of its own, no React.
 */
import { LIGHT_WEIGHT_BY_ROLE, type Conductor } from "./conductor";
import { noteLifetime, type VoicePlan } from "./plan";

/**
 * Hand every note of `plan` that speaks for a concept to `conductor`, as if the
 * plan began at `atSeconds` on the conductor's clock. Structural voices (no
 * concept) light nothing. Returns how many onsets were handed over.
 */
export function publishPlanLights(
  conductor: Pick<Conductor, "sound">,
  plan: VoicePlan,
  atSeconds: number
): number {
  let published = 0;
  for (const note of plan.notes) {
    if (note.conceptId === null) continue;
    conductor.sound({
      conceptId: note.conceptId,
      at: atSeconds + note.atSeconds,
      duration: noteLifetime(note),
      weight: LIGHT_WEIGHT_BY_ROLE[note.role],
    });
    published += 1;
  }
  return published;
}
