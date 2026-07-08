import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { validateContent } from "./src/content/validate";

// Gate every dev-server start and production build on content integrity:
// broken concept references or malformed connections fail loudly, here,
// instead of surfacing as a silent dead bead in the arena.
const contentGate = (): Plugin => ({
  name: "gbg-content-gate",
  buildStart() {
    const { errors, warnings } = validateContent();
    for (const w of warnings) this.warn(`[content] ${w}`);
    if (errors.length > 0) {
      throw new Error(`content validation failed:\n  - ${errors.join("\n  - ")}`);
    }
  },
});

export default defineConfig(({ command, mode }) => ({
  // GitHub Pages serves this project site under /glassbeadgame/. The dev
  // server stays at "/" so local tooling and previews resolve normally.
  base: command === "build" ? "/glassbeadgame/" : "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), contentGate()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["lovable-tagger"],
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-three": ["three"],
          "vendor-r3f": [
            "@react-three/fiber",
            "@react-three/drei",
            "@react-three/postprocessing",
            "postprocessing",
          ],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
  },
}));
