import { drawSession } from "../../game/session";
import { domainSessionStore } from "../../state/domainSession";
import { useStore } from "../../state/store";
import { themeForSession } from "../../themes";
import { gameNow } from "../testMode";
import { createSessionStartCoordinator } from "./createSessionStartCoordinator";
import type { StartSession } from "./createSessionStartCoordinator";
import { productionInterpretation } from "../interpretation";

const startCanonicalSession = createSessionStartCoordinator({
  domainStore: domainSessionStore,
  draw: drawSession,
  now: gameNow,
  selectTheme: themeForSession,
  applyProjection: (projection) => useStore.getState().applySessionStart(projection),
});

export const startSession: StartSession = (picks, options) => {
  const result = startCanonicalSession(picks, options);
  productionInterpretation.reset();
  return result;
};
