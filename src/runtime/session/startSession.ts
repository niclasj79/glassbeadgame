import type { DisciplineId } from "../../content/types";
import { hashString } from "../../lib/utils";
import { domainSessionStore } from "../../state/domainSession";
import { useStore } from "../../state/store";
import { gameNow } from "../testMode";
import { cueBus } from "../cues";
import { productionInterpretation } from "../interpretation";
import {
  createCastaliaSessionStart,
  type CastaliaSessionStartResult,
} from "./createCastaliaSessionStart";

/**
 * THE CUTOVER.
 *
 * Sessions now draw from the Castalia pack — twenty-four authored beads with
 * facets, motifs and sigils — instead of the legacy ninety-concept corpus. This
 * is the change every other part of the campaign was waiting on: until the
 * arena drew Castalia beads, outcome resolution found nothing, every thread
 * fell through to "unresolved", and the whole semantic layer ran empty.
 *
 * Two legacy affordances are deliberately dropped rather than ported:
 *
 *  - **Discipline picking.** The slice has one world (spec §1). A pre-game menu
 *    that asks which three of six disciplines to include is a setup screen for
 *    a game that no longer exists, and it delays the first bead by a decision
 *    the player has no basis for making. The parameter is still accepted so the
 *    existing call sites and the test adapter keep working, and it now only
 *    perturbs the seed — different picks still give a different Game.
 *  - **Theme rotation.** The audit lists "theme rotation that changes
 *    presentation but not play" for removal. Castalia is the world.
 *
 * The legacy projection is still published, because the scene, the HUD and the
 * inspect card all read `useStore().session`. Its score, insight and
 * curatedAvailable fields are written as zero and stay zero: nothing increments
 * them any more, and they are removed with the legacy store.
 */
const startCastaliaSession = createCastaliaSessionStart({
  domainStore: domainSessionStore,
  now: gameNow,
});

export interface StartSessionOptions {
  readonly seed?: number;
  readonly daily?: boolean;
}

export type StartSession = (
  picks?: readonly DisciplineId[],
  options?: StartSessionOptions
) => CastaliaSessionStartResult;

export const startSession: StartSession = (picks, options) => {
  // A numeric seed from the test harness or the daily draw wins; otherwise the
  // picks perturb a fresh seed so two Games in a row are not identical.
  const seedText =
    options?.seed !== undefined
      ? `seed:${options.seed}`
      : `seed:${hashString((picks ?? []).join("+"))}:${gameNow()}`;

  const result = startCastaliaSession({ seed: seedText });

  // Presentation state starts clean: no cue from a previous Game may resolve
  // into this one.
  cueBus.reset();
  productionInterpretation.reset();

  useStore.getState().applySessionStart({
    // The legacy view keeps the caller's numeric seed where one was given, so a
    // supplied seed still means what it meant.
    seed: options?.seed ?? hashString(seedText),
    disciplines: Object.freeze([...(picks ?? [])]),
    beadIds: Object.freeze(result.session.conceptIds.map(String)),
    threads: Object.freeze([]),
    discoveries: Object.freeze([]),
    motifs: Object.freeze([]),
    score: 0,
    startedAt: gameNow(),
    interaction: Object.freeze({
      mode: "idle",
      fromId: null,
      sticky: false,
      reveal: null,
    }),
    curatedAvailable: 0,
    insight: 0,
    illuminationsUsed: 0,
    daily: options?.daily,
    themeId: "castalia",
  });

  return result;
};
