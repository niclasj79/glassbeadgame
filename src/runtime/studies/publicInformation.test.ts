import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { castaliaStudies } from "../../content/castalia/studies";
import { castaliaLookup } from "../content/castaliaLookup";
import { castaliaStudyLookup } from "./lookup";

/**
 * R1 IN THE RUNTIME: PUBLIC INFORMATION ONLY.
 *
 * The evaluator is typed over `ConceptStructureLookup`, but a `RelationLookup`
 * satisfies that type too, so the type alone cannot stop a caller handing it
 * one. These scans close that gap for production code: nothing in the Studies
 * runtime can reach an object that answers documented relations, evidence or
 * Open Thread prompts, and every production call of a Study rule lives where
 * that is true.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "..");

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const name = (path: string): string => relative(SRC, path).split(sep).join("/");

/** Anything in the runtime that can answer a relation, an evidence class or a prompt. */
const RELATION_READERS =
  /\b(castaliaLookup|CASTALIA_LOOKUP|RelationLookup|findRelation|openThreadPrompt|relationByKey|castaliaResonanceLookup)\b/;

describe("the Studies runtime reads public information only (R1)", () => {
  it("holds nothing that can answer a documented relation or an Open Thread", () => {
    const offenders = sourceFiles(HERE)
      .filter((file) => RELATION_READERS.test(withoutComments(readFileSync(file, "utf8"))))
      .map(name);
    expect(offenders).toEqual([]);
  });

  it("calls the Study rules in production only from the domain, the pack's gate and this runtime", () => {
    const callers = sourceFiles(SRC)
      .filter((file) =>
        /\b(evaluateStudy|solveStudy|magisterLine)\s*\(/.test(
          withoutComments(readFileSync(file, "utf8"))
        )
      )
      .map(name)
      .filter((file) => !file.startsWith("domain/studies/"));
    expect(callers.sort()).toEqual([
      "content/castalia/validate.ts",
      "runtime/studies/createStudyProgression.ts",
      "runtime/studies/plate.ts",
    ]);
  });

  it("answers exactly what the pack says of every Study bead, and has no more to say", () => {
    expect(Object.keys(castaliaStudyLookup).sort()).toEqual([
      "conceptFacets",
      "conceptFaculty",
      "conceptName",
    ]);
    for (const study of castaliaStudies()) {
      for (const bead of study.conceptIds) {
        expect(castaliaStudyLookup.conceptName(bead)).toBe(castaliaLookup.conceptName(bead));
        expect(castaliaStudyLookup.conceptFaculty(bead)).toBe(castaliaLookup.conceptFaculty(bead));
        expect(castaliaStudyLookup.conceptFacets(bead)).toEqual(castaliaLookup.conceptFacets(bead));
      }
    }
  });
});
