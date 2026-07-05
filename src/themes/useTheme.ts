import { useStore } from "@/state/store";
import { themeById, type WorldTheme } from "./index";

/** The active world: the session's theme, or Castalia on the title. */
export function useCurrentTheme(): WorldTheme {
  return useStore((s) => themeById(s.session?.themeId));
}

/** Non-React access for imperative modules (audio, threading). */
export function currentTheme(): WorldTheme {
  return themeById(useStore.getState().session?.themeId);
}
