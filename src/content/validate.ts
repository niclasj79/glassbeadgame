import { disciplines } from "./disciplines";
import { concepts } from "./concepts";
import { connections } from "./connections";
import {
  pairKey,
  type Concept,
  type CuratedConnection,
  type Discipline,
  type DisciplineId,
} from "./types";

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  stats: string[];
}

export interface ContentValidationInput {
  disciplines: readonly Discipline[];
  concepts: readonly Concept[];
  connections: readonly CuratedConnection[];
}

const CONCEPTS_PER_DISCIPLINE = 15;
const INSIGHT_MIN = 120;
const INSIGHT_MAX = 480;
const CROSS_PAIR_MIN = 4;

const authoredContent: ContentValidationInput = { disciplines, concepts, connections };

/**
 * Structural integrity for the whole content layer. Runs on every dev-server
 * start and every production build (via the vite plugin in vite.config.ts).
 * Checks activate as the corresponding data lands: an empty concepts or
 * connections array is legal scaffolding, a *wrong* one is a build failure.
 */
export function validateContent(content: ContentValidationInput = authoredContent): ValidationReport {
  const { disciplines, concepts, connections } = content;
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: string[] = [];

  // --- disciplines ---
  if (disciplines.length !== 6) {
    errors.push(`expected 6 disciplines, found ${disciplines.length}`);
  }
  for (const d of disciplines) {
    if (d.degrees.some((deg) => deg < 0 || deg > 4)) {
      errors.push(`discipline ${d.id}: degrees out of pentatonic range 0-4`);
    }
  }

  // --- concepts ---
  const conceptIds = new Set<string>();
  const perDiscipline = new Map<DisciplineId, number>();
  for (const c of concepts) {
    if (conceptIds.has(c.id)) errors.push(`duplicate concept id: ${c.id}`);
    conceptIds.add(c.id);
    if (!disciplines.some((d) => d.id === c.discipline)) {
      errors.push(`concept ${c.id}: unknown discipline ${c.discipline}`);
    }
    perDiscipline.set(c.discipline, (perDiscipline.get(c.discipline) ?? 0) + 1);
    if (c.tbg.some((v) => v < -1 || v > 1)) {
      errors.push(`concept ${c.id}: tbg coordinate out of [-1, 1]`);
    }
    if (c.pitchDegree < 0 || c.pitchDegree > 4) {
      errors.push(`concept ${c.id}: pitchDegree out of range 0-4`);
    }
    if (c.keywords.length < 2) {
      errors.push(`concept ${c.id}: needs >= 2 keywords for the faint-resonance composer`);
    }
    if (c.description.length < 60) {
      errors.push(`concept ${c.id}: description suspiciously short (${c.description.length} chars)`);
    }
  }
  if (concepts.length > 0) {
    for (const d of disciplines) {
      const n = perDiscipline.get(d.id) ?? 0;
      if (n !== CONCEPTS_PER_DISCIPLINE) {
        errors.push(`discipline ${d.id}: expected ${CONCEPTS_PER_DISCIPLINE} concepts, found ${n}`);
      }
    }
  }

  // --- connections ---
  const seenPairs = new Set<string>();
  const coverage = new Map<string, number>(); // "discA|discB" sorted -> count
  const conceptCoverage = new Map<string, number>();
  for (const conn of connections) {
    const [a, b] = conn.pair;
    if (a === b) errors.push(`connection ${conn.id}: self-pair`);
    const key = pairKey(a, b);
    if (conn.id !== key) {
      errors.push(`connection ${conn.id}: id must equal sorted pairKey (${key})`);
    }
    if (seenPairs.has(key)) errors.push(`duplicate connection for pair: ${key}`);
    seenPairs.add(key);
    for (const cid of conn.pair) {
      if (concepts.length > 0 && !conceptIds.has(cid)) {
        errors.push(`connection ${conn.id}: unknown concept ${cid}`);
      }
      conceptCoverage.set(cid, (conceptCoverage.get(cid) ?? 0) + 1);
    }
    if (conn.insight.length < INSIGHT_MIN || conn.insight.length > INSIGHT_MAX) {
      errors.push(
        `connection ${conn.id}: insight length ${conn.insight.length} outside ${INSIGHT_MIN}-${INSIGHT_MAX}`
      );
    }
    if (conn.title.length < 3 || conn.title.length > 60) {
      errors.push(`connection ${conn.id}: title length out of bounds`);
    }
    const da = concepts.find((c) => c.id === a)?.discipline;
    const db = concepts.find((c) => c.id === b)?.discipline;
    if (da && db) {
      const dKey = [da, db].sort().join("|");
      coverage.set(dKey, (coverage.get(dKey) ?? 0) + 1);
    }
  }

  // --- coverage report (informational until the connection corpus matures) ---
  if (connections.length > 0 && concepts.length > 0) {
    const ids = disciplines.map((d) => d.id).sort();
    stats.push(`connections total: ${connections.length}`);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i; j < ids.length; j++) {
        const dKey = [ids[i], ids[j]].sort().join("|");
        const n = coverage.get(dKey) ?? 0;
        stats.push(`  ${dKey}: ${n}`);
        if (i !== j && n < CROSS_PAIR_MIN) {
          warnings.push(`coverage: ${dKey} has only ${n} connections (target >= ${CROSS_PAIR_MIN})`);
        }
      }
    }
    const uncovered = [...conceptIds].filter((id) => !conceptCoverage.has(id));
    if (uncovered.length > 0) {
      warnings.push(`concepts in no curated connection: ${uncovered.join(", ")}`);
    }
  }

  return { errors, warnings, stats };
}
