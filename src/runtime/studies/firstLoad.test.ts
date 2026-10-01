import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE STUDIES LOAD WITH THE STUDIES (`scripts/bundle-budgets.json`).
 *
 * The first load is gated in bytes by `npm run bundle:check`; this proves the
 * rule itself, before a build: walking every *static* import from the entry —
 * type-only imports erased, dynamic imports not followed, exactly as the
 * bundler treats them — never reaches the Studies runtime. A screen that
 * imported it statically from the first load would fail here by name, rather
 * than as a few hundred bytes nobody can place.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "..");
const ENTRY = join(SRC, "main.tsx");
const STUDIES_RUNTIME = join(SRC, "runtime", "studies");
const STUDIES_CONTENT = join(SRC, "content", "castalia", "studies.ts");

const CANDIDATES = ["", ".ts", ".tsx", `${sep}index.ts`, `${sep}index.tsx`];

function resolveModule(from: string, specifier: string): string | null {
  const base = specifier.startsWith(".")
    ? resolve(dirname(from), specifier)
    : specifier.startsWith("@/")
      ? join(SRC, specifier.slice(2))
      : null;
  if (base === null) return null;
  for (const suffix of CANDIDATES) {
    const path = `${base}${suffix}`;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

/** Static, value-carrying imports and re-exports; `import type` is erased. */
function staticImportsOf(source: string): readonly string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const found: string[] = [];
  for (const match of code.matchAll(
    /\b(import|export)\s+(type\s+)?([^'";]*?)\bfrom\s*["']([^"']+)["']/g
  )) {
    if (match[2] === undefined) found.push(match[4] as string);
  }
  for (const match of code.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
    found.push(match[1] as string);
  }
  return found;
}

/** Every source file the entry reaches statically, with who imported it. */
function firstLoad(): ReadonlyMap<string, readonly string[]> {
  const importers = new Map<string, string[]>([[ENTRY, []]]);
  const queue = [ENTRY];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (!/\.tsx?$/.test(file)) continue;
    for (const specifier of staticImportsOf(readFileSync(file, "utf8"))) {
      const target = resolveModule(file, specifier);
      if (target === null) continue;
      const known = importers.get(target);
      if (known !== undefined) {
        known.push(file);
        continue;
      }
      importers.set(target, [file]);
      queue.push(target);
    }
  }
  return importers;
}

const name = (path: string): string => relative(SRC, path).split(sep).join("/");

describe("the first load", () => {
  const reached = firstLoad();

  it("is walked from the entry through the whole application", () => {
    for (const expected of [
      "App.tsx",
      "scene/ThreadingDriver.tsx",
      "runtime/interpretation/productionInterpretation.ts",
      "runtime/cues/planCues.ts",
      "runtime/scene/createSceneDirector.ts",
      "audio/ambient.ts",
      "audio/conductor.ts",
      "state/studies/index.ts",
    ]) {
      expect([...reached.keys()].map(name)).toContain(expected);
    }
  });

  it("never reaches the semantic audio layer, which loads after the title (ADR-016)", () => {
    // The director, its planners and its scheduler answer cues, and the first
    // cue comes after the first press; the bridge fetches them as a chunk of
    // their own. A static import that pulled them back into the first load
    // would cost the ceiling what the conductor was allowed to.
    for (const deferred of [
      "audio/productionAudio.ts",
      "audio/director.ts",
      "audio/scheduler.ts",
      "audio/attunement.ts",
      "audio/conclusion.ts",
      "audio/pulse.ts",
      "audio/pulseBodies.ts",
      "audio/stems.ts",
    ]) {
      expect([...reached.keys()].map(name)).not.toContain(deferred);
    }
  });

  it("never reaches the Studies runtime", () => {
    const studies = [...reached.keys()].filter((file) =>
      file.startsWith(`${STUDIES_RUNTIME}${sep}`)
    );
    expect(
      studies.map((file) => `${name(file)} <- ${(reached.get(file) ?? []).map(name).join(", ")}`)
    ).toEqual([]);
  });

  it("reaches the authored Studies only through the build's content gate, which runs nothing at load", () => {
    expect((reached.get(STUDIES_CONTENT) ?? []).map(name)).toEqual([
      "content/castalia/validate.ts",
    ]);
  });
});
