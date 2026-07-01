import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/cormorant";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
