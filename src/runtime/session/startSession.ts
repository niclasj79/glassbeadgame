import { drawSession } from "../../game/session";
import { domainSessionStore } from "../../state/domainSession";
import { useStore } from "../../state/store";
import { themeForSession } from "../../themes";
import { gameNow } from "../testMode";
import { createSessionStartCoordinator } from "./createSessionStartCoordinator";

export const startSession = createSessionStartCoordinator({
  domainStore: domainSessionStore,
  draw: drawSession,
  now: gameNow,
  selectTheme: themeForSession,
  applyProjection: (projection) => useStore.getState().applySessionStart(projection),
});
