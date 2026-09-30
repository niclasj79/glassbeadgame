import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyPlateModel } from "@/runtime/studies";
import { useStore } from "@/state/store";
import { installMotionDomStubs } from "../testing/domStubs";
import { byTestId, press } from "../arena/testing/elementTree";
import {
  PLATE_LAST,
  PLATE_SILENCE,
  PLATE_THREADS,
  STUDY_FORBIDDEN,
  decode,
  spoken,
} from "../arena/testing/studyFixtures";
import { StudyPlate, StudyPlateSurface } from "./StudyPlate";

/**
 * THE SOLVED PLATE (STUDIES-SPEC §6, §7). Its words are the runtime's
 * (`studies.plate()`), so the models below are written as the runtime renders
 * them — the lines from the domain's `describeStudyLine`, the counts said
 * plainly — and the plate is asserted to set exactly those, with its three
 * ways on each calling its verb.
 */

const verbs = vi.hoisted(() => ({
  start: vi.fn(),
  restart: vi.fn(),
  next: vi.fn(),
  leave: vi.fn(),
  declareSilence: vi.fn(),
  plate: vi.fn((): StudyPlateModel | null => null),
}));

vi.mock("@/runtime/studies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/runtime/studies")>();
  return { ...actual, studies: Object.freeze({ ...actual.studies, ...verbs }) };
});

const THREADS = PLATE_THREADS;
const SILENCE = PLATE_SILENCE;
const LAST = PLATE_LAST;

const render = (model: StudyPlateModel, reducedMotion = true): string =>
  renderToStaticMarkup(createElement(StudyPlateSurface, { model, reducedMotion }));

/** The text content of the first element carrying `data-testid`. */
const textOf = (html: string, testId: string): string | null => {
  const match = new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</p>`).exec(html);
  return match === null ? null : decode(match[1].replace(/<[^>]*>/g, ""));
};

describe("the solved plate", () => {
  beforeAll(installMotionDomStubs);
  beforeEach(() => {
    for (const verb of Object.values(verbs)) verb.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is a labelled, modal dialog that can take focus", () => {
    const html = render(THREADS);
    const [dialog] = html.match(/<div [^>]*data-testid="study-plate"[^>]*>/) ?? [];
    expect(dialog).toBeDefined();
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('tabindex="-1"');
    // Labelled by its state and its brief; described by the player's answer.
    expect(dialog).toContain('aria-labelledby="study-plate-state study-plate-brief"');
    expect(dialog).toContain('aria-describedby="study-plate-player-line"');
    expect(html).toMatch(/id="study-plate-state"[^>]*>Solved</);
    expect(decode(html)).toMatch(/id="study-plate-brief"[^>]*>From The Möbius Band to Counterpoint in two threads</);
    expect(html).toContain('id="study-plate-player-line"');
    // The plate takes focus as it opens, and hands it back as it closes.
    const plate = readFileSync(join(process.cwd(), "src", "ui", "screens", "StudyPlate.tsx"), "utf8");
    expect(plate).toContain("dialog.current?.focus()");
    expect(plate).toContain("before.focus()");
  });

  it("sets the player's line beside the Magister's, the counts, and the marks as words", () => {
    const html = render(THREADS);
    expect(textOf(html, "study-plate-player-line")).toBe(THREADS.playerLine);
    expect(textOf(html, "study-plate-magister-line")).toBe(THREADS.magisterLine);
    expect(textOf(html, "study-plate-counts")).toBe("Solved in five; the brief asked for two.");
    expect(textOf(html, "study-plate-marks")).toBe("Wide · Varied");
    const marks = [...html.matchAll(/data-testid="study-plate-mark"[^>]*>([^<]*)</g)].map(
      (match) => match[1]
    );
    expect(marks).toEqual(["Wide", "Varied"]);
    // Whose answer is whose, said in words.
    expect(decode(html)).toContain("Your answer");
    expect(decode(html)).toContain("The Magister’s answer");
    // In the order the specification gives: the lines, the counts, the marks.
    const at = (testId: string): number => html.indexOf(`data-testid="${testId}"`);
    expect(at("study-plate-player-line")).toBeLessThan(at("study-plate-magister-line"));
    expect(at("study-plate-magister-line")).toBeLessThan(at("study-plate-counts"));
    expect(at("study-plate-counts")).toBeLessThan(at("study-plate-marks"));
  });

  it("sets up to three marks, and no marks line at all when there are none", () => {
    expect(textOf(render(LAST), "study-plate-marks")).toBe("Economical · Wide · Varied");
    const silence = render(SILENCE);
    expect(silence).not.toContain('data-testid="study-plate-marks"');
    expect(silence).not.toContain("The form of your answer");
    // A marks line is never gilded or badged: marks are words, not rewards.
    expect(render(LAST)).not.toMatch(/data-testid="study-plate-marks"[^>]*class="[^"]*(?:gold|glow|badge)/);
  });

  it("states a silence in the structure of the beads, with no counts", () => {
    const html = render(SILENCE);
    expect(html).toContain('data-by="silence"');
    expect(textOf(html, "study-plate-player-line")).toBe("No Matter bead here carries Proportion.");
    // The Magister's answer to a silence is the declaration itself.
    expect(textOf(html, "study-plate-magister-line")).toBe("It cannot be done.");
    expect(html).not.toContain('data-testid="study-plate-counts"');
  });

  it("offers three ways on, and each calls its verb", () => {
    const html = render(THREADS);
    const ways = [...html.matchAll(/data-testid="(study-plate-(?:again|next|back))"[^>]*>([^<]*)</g)].map(
      (match) => [match[1], match[2]]
    );
    expect(ways).toEqual([
      ["study-plate-again", "Again"],
      ["study-plate-next", "Next Study"],
      ["study-plate-back", "Back to the Studies"],
    ]);
    // All three are set alike, so the plate suggests none of them.
    const classes = [...html.matchAll(/data-testid="study-plate-(?:again|next|back)"[^>]*class="([^"]*)"/g)].map(
      (match) => match[1]
    );
    expect(new Set(classes).size).toBe(1);

    const tree = StudyPlateSurface({ model: THREADS, reducedMotion: true });
    press(byTestId(tree, "study-plate-again")[0]);
    expect(verbs.restart).toHaveBeenCalledTimes(1);
    press(byTestId(tree, "study-plate-next")[0]);
    expect(verbs.next).toHaveBeenCalledTimes(1);
    press(byTestId(tree, "study-plate-back")[0]);
    expect(verbs.leave).toHaveBeenCalledTimes(1);
    expect(verbs.start).not.toHaveBeenCalled();
    expect(verbs.declareSilence).not.toHaveBeenCalled();
  });

  it("takes no second answer while it fades", () => {
    const html = renderToStaticMarkup(
      createElement(StudyPlateSurface, { model: THREADS, reducedMotion: true, leaving: true })
    );
    expect(html).toMatch(/^<div class="fixed inset-0 z-20"[^>]*style="[^"]*pointer-events:none/);
    // It keeps what it said while it goes.
    expect(textOf(html, "study-plate-player-line")).toBe(THREADS.playerLine);
    const tree = StudyPlateSurface({ model: THREADS, reducedMotion: true, leaving: true });
    for (const way of ["study-plate-again", "study-plate-next", "study-plate-back"]) {
      press(byTestId(tree, way)[0]);
    }
    expect(verbs.restart).not.toHaveBeenCalled();
    expect(verbs.next).not.toHaveBeenCalled();
    expect(verbs.leave).not.toHaveBeenCalled();
    // A plate that is present answers at once.
    expect(render(THREADS)).not.toMatch(/^<div class="fixed inset-0 z-20"[^>]*pointer-events:none/);
  });

  it("is shown by the solved moment alone, and keeps its words on the way out", () => {
    const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
    // Driven by `plateOpen` and nothing else of the Study's status.
    expect(app).toMatch(/phase === "arena" && studying && plateOpen &&/);
    expect(app).not.toMatch(/status\.kind|kind === "solved"/);
    const plate = readFileSync(join(process.cwd(), "src", "ui", "screens", "StudyPlate.tsx"), "utf8");
    expect(plate).toContain("useHeldWhileLeaving(useStudy(selectPlate))");
  });

  it("offers no Next Study after the last", () => {
    const html = render(LAST);
    expect(html).not.toContain('data-testid="study-plate-next"');
    expect(html).toContain('data-testid="study-plate-again"');
    expect(html).toContain('data-testid="study-plate-back"');
    expect(byTestId(StudyPlateSurface({ model: LAST, reducedMotion: false }), "study-plate-next")).toHaveLength(0);
  });

  it("shortens its entrance and removes its travel under reduced motion", () => {
    const [still] = byTestId(StudyPlateSurface({ model: THREADS, reducedMotion: true }), "study-plate");
    const [moving] = byTestId(StudyPlateSurface({ model: THREADS, reducedMotion: false }), "study-plate");
    const duration = (element: typeof still): number =>
      (element.props.transition as { duration: number }).duration;
    expect(duration(still)).toBeLessThan(duration(moving));
    expect(duration(still)).toBeLessThanOrEqual(0.2);
    expect(still.props.initial).toEqual({ opacity: 0 });
    expect(moving.props.initial).toEqual({ opacity: 0, y: 8 });
    expect(render(THREADS, true)).not.toMatch(/data-testid="study-plate"[^>]*translateY/);
  });

  it("reads its words from the runtime, and is not drawn without them", () => {
    verbs.plate.mockReturnValue(THREADS);
    const html = renderToStaticMarkup(createElement(StudyPlate));
    expect(html).toContain('data-testid="study-plate"');
    expect(textOf(html, "study-plate-player-line")).toBe(THREADS.playerLine);
    expect(verbs.plate).toHaveBeenCalled();

    verbs.plate.mockReturnValue(null);
    expect(renderToStaticMarkup(createElement(StudyPlate))).toBe("");
  });

  it("follows the player's reduced-motion setting", () => {
    verbs.plate.mockReturnValue(THREADS);
    const initial = useStore.getInitialState();
    vi.spyOn(useStore, "getInitialState").mockReturnValue({
      ...initial,
      settings: { ...initial.settings, reducedMotion: false },
    });
    expect(renderToStaticMarkup(createElement(StudyPlate))).toMatch(
      /data-testid="study-plate"[^>]*style="[^"]*translateY\(8px\)/
    );
    vi.restoreAllMocks();
    vi.spyOn(useStore, "getInitialState").mockReturnValue({
      ...initial,
      settings: { ...initial.settings, reducedMotion: true },
    });
    expect(renderToStaticMarkup(createElement(StudyPlate))).not.toMatch(
      /data-testid="study-plate"[^>]*translateY/
    );
  });

  it("says nothing that counts, totals or judges", () => {
    for (const model of [THREADS, SILENCE, LAST]) {
      const text = spoken(render(model));
      expect(text, model.studyId).not.toMatch(STUDY_FORBIDDEN);
      // Marks describe a form; nothing on the plate praises or ranks one.
      expect(text, model.studyId).not.toMatch(/\bbest\b|\bperfect\b|\bexcellent\b|\bwell done\b/i);
    }
  });
});
