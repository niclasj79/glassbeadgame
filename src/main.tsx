import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/cormorant/index.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./index.css";
import App from "./App";
import { useStore } from "./state/store";

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__gbg = {
    get state() {
      return useStore.getState();
    },
  };
}

// Sweep away the archived v1 app's localStorage remnants (same origin).
try {
  for (const key of Object.keys(localStorage)) {
    if (
      key === "glass-bead-game-state" ||
      key === "game-error-log" ||
      key.startsWith("session-offline") ||
      key.startsWith("movements-offline")
    ) {
      localStorage.removeItem(key);
    }
  }
} catch {
  /* storage may be unavailable; nothing to clean */
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
