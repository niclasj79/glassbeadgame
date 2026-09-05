import { domainSessionStore } from "../../state/domainSession";
import { castaliaLookup } from "../content/castaliaLookup";
import { gameNow } from "../testMode";
import { progressRepository } from "./progressRepository";
import { createSessionArchive } from "./sessionArchive";

/**
 * The production archive: the canonical store, the one repository, the one
 * content lookup, the game clock. Created when this module is first imported,
 * which the title screen does before any Game can begin — so the subscription
 * is in place before the first `session.concluded` can be appended.
 *
 * The annotation builder is loaded on demand. It lives with the conclusion,
 * which is behind a dynamic import so that nobody who never concludes a Game
 * pays for it (see `App.tsx`); by the time a Game concludes that chunk has
 * been prefetched for twelve to eighteen minutes, so the await here is free.
 */
export const sessionArchive = createSessionArchive({
  domainStore: domainSessionStore,
  repository: progressRepository,
  describe: async (session) => {
    const { buildAnnotation } = await import("../../domain/annotation");
    return buildAnnotation(session, castaliaLookup).text;
  },
  now: gameNow,
});
