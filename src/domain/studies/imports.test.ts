import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * DOMAIN PURITY, PROVED BY READING THE FILES.
 *
 * Nothing under `src/domain/studies` may reach outside `src/domain` — no
 * content, runtime, state, scene, audio, UI, browser or storage (M9-001). The
 * evaluator's type already keeps documented relations out of reach (R1); this
 * scan keeps the whole module inside the domain, aliases included. Test files
 * may also use the test harness and the Node built-ins this scan needs.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DOMAIN = resolve(HERE, "..");
const HARNESS = new Set(["vitest", "node:fs", "node:path", "node:url"]);

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/**
 * Every module specifier — static imports and re-exports, side-effect imports
 * and dynamic imports — with comments removed first, so prose about importing
 * is never mistaken for an import.
 */
function specifiersOf(source: string): readonly string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const patterns = [
    /\b(?:import|export)\b[^'";]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  return patterns.flatMap((pattern) =>
    [...code.matchAll(pattern)].map((match) => match[1] as string)
  );
}

function isInsideDomain(file: string, specifier: string): boolean {
  const target = specifier.startsWith(".")
    ? resolve(dirname(file), specifier)
    : specifier.startsWith("@/")
      ? resolve(DOMAIN, "..", specifier.slice(2))
      : null;
  return target !== null && (target === DOMAIN || target.startsWith(`${DOMAIN}${sep}`));
}

describe("src/domain/studies imports", () => {
  const files = sourceFiles(HERE);

  it("scans the whole module", () => {
    const names = files.map((file) => relative(HERE, file).split(sep).join("/"));
    expect(names).toEqual(
      expect.arrayContaining([
        "types.ts",
        "goal.ts",
        "order.ts",
        "solveStudy.ts",
        "evaluateStudy.ts",
        "describe.ts",
        "magisterLine.ts",
        "index.ts",
        "imports.test.ts",
        "testing/buildStudySession.ts",
        "testing/studyFixtures.ts",
      ])
    );
  });

  it("reaches nothing outside src/domain", () => {
    const outside: string[] = [];
    for (const file of files) {
      const isTest = file.endsWith(".test.ts");
      for (const specifier of specifiersOf(readFileSync(file, "utf8"))) {
        if (isTest && HARNESS.has(specifier)) continue;
        if (!isInsideDomain(file, specifier)) {
          outside.push(`${relative(HERE, file)} → ${specifier}`);
        }
      }
    }
    expect(outside).toEqual([]);
  });

  it("recognises every form of import it has to judge, and refuses the outside ones", () => {
    // Spelled at run time, so this file's own scan does not read the samples.
    const im = ["im", "port"].join("");
    const ex = ["ex", "port"].join("");
    const sample = [
      `${im} { a } from "./a";`,
      `${im} type { B } from "../b";`,
      `${ex} { c } from "@/content/castalia";`,
      `${im} "../side-effect";`,
      `const d = await ${im}("react");`,
      `${im} {\n  e,\n  f,\n} from '../../runtime/x';`,
      `/* ${im} { g } from "@/state/store"; */`,
    ].join("\n");
    const found = specifiersOf(sample);
    expect([...found].sort()).toEqual(
      ["../../runtime/x", "../b", "../side-effect", "./a", "@/content/castalia", "react"].sort()
    );

    const file = join(HERE, "sample.ts");
    expect(isInsideDomain(file, "./a")).toBe(true);
    expect(isInsideDomain(file, "../ids")).toBe(true);
    expect(isInsideDomain(file, "@/domain/ids")).toBe(true);
    expect(isInsideDomain(file, "../../content/castalia")).toBe(false);
    expect(isInsideDomain(file, "@/content/castalia")).toBe(false);
    expect(isInsideDomain(file, "react")).toBe(false);
  });
});
