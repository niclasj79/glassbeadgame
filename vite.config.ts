import { defineConfig, runnerImport, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { CASTALIA_PACK } from "./src/content/castalia";
import type {
  assertCastaliaPackValid,
  validateCastaliaPack,
} from "./src/content/castalia/validate";

const SRC = path.resolve(__dirname, "./src");

interface ContentGateModule {
  readonly CASTALIA_PACK: typeof CASTALIA_PACK;
  readonly assertCastaliaPackValid: typeof assertCastaliaPackValid;
  readonly validateCastaliaPack: typeof validateCastaliaPack;
}

/**
 * Gate every dev-server start and production build on content integrity: a
 * relation naming an unknown concept, an intention with no fallback prompt, or
 * a claim of influence with no source fails loudly here instead of surfacing as
 * a silent dead bead in the arena.
 *
 * The pack is loaded through Vite's own module runner rather than imported at
 * the top of this file. A config file is bundled before any user `resolve.alias`
 * exists, and the Castalia pack reaches the domain through `@/…` — so a plain
 * import resolves in the editor and then fails at build time. Loading it here,
 * with the alias supplied explicitly, is what lets the gate read the same pack
 * the application will.
 */
const contentGate = (): Plugin => ({
  name: "gbg-content-gate",
  async buildStart() {
    const { module } = await runnerImport<ContentGateModule>(
      "./src/content/castalia/index.ts",
      // `configFile: false` matters: resolving this project's config would
      // re-instantiate this very plugin.
      { configFile: false, resolve: { alias: { "@": SRC } } }
    );
    for (const w of module.validateCastaliaPack(module.CASTALIA_PACK).warnings) {
      this.warn(`[content] ${w}`);
    }
    // Throws with every error listed. A broken pack must not reach a bundle.
    module.assertCastaliaPackValid(module.CASTALIA_PACK);
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
