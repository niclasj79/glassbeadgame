import { useStore } from "@/state/store";

/** Persistent corner control — the one piece of chrome present on every screen. */
export function SoundToggle() {
  const muted = useStore((s) => s.settings.muted);
  const setMuted = useStore((s) => s.setMuted);

  return (
    <button
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      title={muted ? "Sound off" : "Sound on"}
      className="absolute bottom-5 right-5 z-20 rounded-full border border-line/40 bg-surface/50 p-3 text-dim backdrop-blur-md transition-colors hover:border-line/80 hover:text-bright"
    >
      {muted ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M11 5L6 9H3v6h3l5 4V5z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M22 9l-6 6M16 9l6 6" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M11 5L6 9H3v6h3l5 4V5z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 8.5a5 5 0 010 7M18.5 6a9 9 0 010 12"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
