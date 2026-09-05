import { parseSessionEventLogV1 } from "../../domain/replay";
import { hashString } from "../../lib/utils";
import type { PersistedSessionRecord } from "../../platform/indexeddb/schema";
import { domainSessionStore } from "../../state/domainSession";
import { useStore } from "../../state/store";
import { cueBus } from "../cues";
import { productionInterpretation } from "../interpretation";

/**
 * Take a kept Game down from the shelf.
 *
 * The record is its log; replaying it is the whole of re-opening it. The
 * conclusion screen derives the portrait, the annotation and the register
 * from the canonical store, so a kept Game reads back as exactly the reading
 * it was — and because the archive keeps only live endings, loading it here
 * writes nothing (`sessionArchive`).
 *
 * The legacy presentation projection is filled the way `startSession` fills
 * it, with the seed hashed the same way, so the arena lays the beads out where
 * they stood: the web is drawn behind the reading, as it is after a live
 * conclusion.
 */
export function openKeptGame(record: PersistedSessionRecord): void {
  const eventLog = parseSessionEventLogV1(record.eventLog);

  // No cue from a previous Game may resolve into this reading.
  cueBus.reset();
  productionInterpretation.reset();

  domainSessionStore.getState().loadEventLog(eventLog);
  const session = domainSessionStore.getState().session;
  if (!session) throw new Error("the kept Game did not replay");

  useStore.getState().openKeptGame({
    seed: hashString(session.seed),
    disciplines: Object.freeze([]),
    beadIds: Object.freeze(session.conceptIds.map(String)),
    threads: Object.freeze([]),
    discoveries: Object.freeze([]),
    motifs: Object.freeze([]),
    score: 0,
    startedAt: eventLog.events[0]?.at ?? record.endedAt,
    interaction: Object.freeze({
      mode: "idle",
      fromId: null,
      sticky: false,
      reveal: null,
    }),
    curatedAvailable: 0,
    insight: 0,
    illuminationsUsed: 0,
    themeId: "castalia",
  });
}
