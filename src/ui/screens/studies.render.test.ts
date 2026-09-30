import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { studies } from "@/runtime/studies";
import { castaliaStudies } from "@/content/castalia/studies";
import { openingWorld } from "@/scene/opening";
import { useStore } from "@/state/store";
import { studyStore } from "@/state/studies";
import { installMotionDomStubs } from "../testing/domStubs";
import { ArenaHud, LeaveStudy } from "../arena/ArenaHud";
import { StudySilenceMirror } from "../arena/InterpretationControls";
import { StudyNote } from "../arena/StudyNote";
import { studyNote } from "../arena/studyMode";
import { byTestId, press } from "../arena/testing/elementTree";
import {
  PLATE_LAST,
  PLATE_SILENCE,
  PLATE_THREADS,
  STUDY_FORBIDDEN,
  decode,
  spoken,
} from "../arena/testing/studyFixtures";
import { StudiesPage, StudiesScreen, type StudiesPageProps } from "./StudiesScreen";
import { StudyPlateSurface } from "./StudyPlate";
import { TitleScreen } from "./TitleScreen";

/**
 * THE STUDIES LIST (STUDIES-SPEC §7): three chapters in their order, every
 * Study by its brief, a Begin beside each, and a way back — with no result,
 * no count and no progress anywhere on the page. The session verbs are mocked;
 * the chapters and briefs are the real ones, rendered from the authored goals.
 */

const verbs = vi.hoisted(() => ({
  start: vi.fn(),
  restart: vi.fn(),
  next: vi.fn(),
  leave: vi.fn(),
  declareSilence: vi.fn(),
  plate: vi.fn(() => null),
}));

vi.mock("@/runtime/studies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/runtime/studies")>();
  return { ...actual, studies: Object.freeze({ ...actual.studies, ...verbs }) };
});

const source = (path: string): string =>
  readFileSync(join(process.cwd(), "src", ...path.split("/")), "utf8");

/** Source with its commentary removed, so a test of the code is not a test of the prose. */
const code = (path: string): string =>
  source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const noop = (): void => undefined;

const pageProps = (overrides: Partial<StudiesPageProps> = {}): StudiesPageProps => ({
  chapters: studies.chapters(),
  reducedMotion: true,
  leaving: false,
  onBegin: noop,
  onBack: noop,
  ...overrides,
});

const render = (overrides: Partial<StudiesPageProps> = {}): string =>
  renderToStaticMarkup(createElement(StudiesPage, pageProps(overrides)));


const attributeValues = (html: string, name: string): string[] =>
  [...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((match) => decode(match[1]));

describe("the Studies list", () => {
  beforeAll(installMotionDomStubs);
  beforeEach(() => {
    for (const verb of Object.values(verbs)) verb.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState(useStore.getInitialState(), true);
  });

  it("shows the three chapters in order, by name", () => {
    const html = render();
    expect(html).toContain('data-testid="studies-screen"');
    expect(attributeValues(html, "data-chapter")).toEqual([
      "eschholz",
      "waldzell",
      "vicus-lusorum",
    ]);
    const names = [...html.matchAll(/<h2 [^>]*>([^<]*)<\/h2>/g)].map((match) => match[1]);
    expect(names).toEqual(["Eschholz", "Waldzell", "Vicus Lusorum"]);
  });

  it("lists all twelve Studies by their briefs, in order within each chapter", () => {
    const html = render();
    const listed = attributeValues(html, "data-study-id");
    const authored = castaliaStudies();
    expect(listed).toHaveLength(authored.length);
    expect(listed).toHaveLength(12);
    // Chapters in their order, and within a chapter by ordinal.
    const expected = ["eschholz", "waldzell", "vicus-lusorum"].flatMap((chapter) =>
      authored
        .filter((study) => study.chapter === chapter)
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((study) => String(study.id))
    );
    expect(listed).toEqual(expected);
    // Each by its brief, as the runtime renders it — identical wording for every kind of Study.
    const briefs = [...html.matchAll(/data-testid="study-listing-brief"[^>]*>([^<]*)</g)].map(
      (match) => decode(match[1])
    );
    expect(briefs).toEqual(listed.map((id) => studies.briefOf(id)));
    expect(briefs).toContain("From The Möbius Band to Counterpoint in two threads");
    expect(briefs).toContain("Carry Proportion into Matter");
  });

  it("offers Begin beside every Study, named by its brief for a screen reader", () => {
    const html = render();
    for (const id of attributeValues(html, "data-study-id")) {
      const begin = new RegExp(
        `<button [^>]*data-testid="study-begin-${id.replace(/\./g, "\\.")}"[^>]*>Begin</button>`
      ).exec(html);
      expect(begin, id).not.toBeNull();
      expect(decode(begin![0])).toContain(`aria-label="Begin — ${studies.briefOf(id)}"`);
    }
  });

  it("begins the Study a Begin names, and goes back from its own control", () => {
    const begun: string[] = [];
    let back = 0;
    const tree = StudiesPage(
      pageProps({
        onBegin: (id) => begun.push(id),
        onBack: () => {
          back += 1;
        },
      })
    );
    press(byTestId(tree, "study-begin-study.waldzell-3")[0]);
    press(byTestId(tree, "study-begin-study.eschholz-1")[0]);
    expect(begun).toEqual(["study.waldzell-3", "study.eschholz-1"]);
    press(byTestId(tree, "studies-back")[0]);
    expect(back).toBe(1);
  });

  it("answers the press before the Study is built, behind a paint, and only once", () => {
    // The threshold's law (`threshold.test.ts`), on the press that now builds a session.
    const screen = code("ui/screens/StudiesScreen.tsx");
    const flip = screen.indexOf("setLeaving(studyId)");
    const build = screen.indexOf("studies.start(leaving)");
    expect(flip).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(flip);
    expect(screen).toContain("requestAnimationFrame");
    expect(screen).not.toMatch(/onClick=\{\(\) => studies\.start/);
    // Answered on the way down, and arriving twice is a no-op.
    expect(screen).toMatch(/onPointerDown=\{[\s\S]{0,200}onBegin\(study\.id\)/);
    expect(screen).toContain("if (pressed.current) return;");
    // The way back returns to the title.
    expect(screen).toContain("useStore.getState().returnToTitle()");
    // While it leaves, the page answers by going, and takes no second press.
    const leaving = render({ leaving: true });
    expect(leaving).toMatch(/data-testid="studies-screen"[^>]*style="[^"]*pointer-events:none/);
  });

  it("is the page the phase shows, read from the runtime", () => {
    useStore.getState().openStudies();
    const html = renderToStaticMarkup(createElement(StudiesScreen));
    expect(html).toContain('data-testid="studies-screen"');
    expect(html).toContain('data-testid="studies-back"');
    expect(html.match(/data-testid="study-begin-/g)).toHaveLength(12);
    // Nothing is begun by showing the page.
    expect(verbs.start).not.toHaveBeenCalled();
  });

  it("shows briefs, never results, counts or progress", () => {
    const html = render();
    const text = spoken(html);
    expect(text).not.toMatch(STUDY_FORBIDDEN);
    expect(text).not.toMatch(/\blevel\b/i);
    // The listings say what each Study asks and nothing about how it went.
    const listings = spoken(html.slice(html.indexOf('data-testid="studies-chapter"')));
    expect(listings).not.toMatch(/\bsolved\b|\bnot yet\b|\blocked\b|\bnew\b|\bdone\b|\bagain\b/i);
    // No bar, no meter, no tick: nothing on the page marks a Study done.
    expect(html).not.toMatch(/role="progressbar"|<progress|<meter|aria-valuenow|✓|✔/);
    // A silence Study is not told apart from the others before it is solved.
    expect(listings).not.toMatch(/silence|cannot|impossible/i);
    // Every listing is the same markup around its own brief, whatever its answer.
    const shape = (id: string): string => {
      const listing = new RegExp(
        `<li [^>]*data-study-id="${id.replace(/\./g, "\\.")}"[^>]*>[\\s\\S]*?</li>`
      ).exec(html);
      expect(listing, id).not.toBeNull();
      return decode(listing![0]).split(studies.briefOf(id)).join("BRIEF").split(id).join("ID");
    };
    const shapes = new Set(castaliaStudies().map((study) => shape(String(study.id))));
    expect(shapes.size).toBe(1);
  });
});

describe("every Study surface", () => {
  beforeAll(installMotionDomStubs);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("carries no count, total, percentage, score, points, rank or wrong", () => {
    const surfaces: Array<readonly [string, string]> = [];

    // The title's second door, and nothing else of the title: its epigraph
    // cites a fragment by number, which is Heraclitus's and not a Study's.
    vi.spyOn(openingWorld, "isReady").mockReturnValue(true);
    const title = renderToStaticMarkup(createElement(TitleScreen));
    const [door] = title.match(/<button [^>]*data-testid="title-studies"[^>]*>[^<]*<\/button>/) ?? [];
    expect(door).toBeDefined();
    surfaces.push(["the title's door", door!]);

    surfaces.push(["the Studies list", renderToStaticMarkup(createElement(StudiesScreen))]);

    // The arena in every Study, with its brief open and set aside, and with
    // either kind of not yet under it.
    for (const study of studies.chapters().flatMap((chapter) => chapter.studies)) {
      for (const state of [
        studyNote(study.id, null, true),
        studyNote(study.id, null, false),
        studyNote(study.id, { kind: "can-be-done", serial: 2 }, true),
        studyNote(study.id, { kind: "no-answer-yet", serial: 3 }, false),
      ]) {
        surfaces.push([
          `the brief of ${study.id}`,
          renderToStaticMarkup(
            createElement(StudyNote, { note: state, reducedMotion: false, onToggleBrief: () => undefined })
          ),
        ]);
      }
    }
    const initial = studyStore.getInitialState();
    vi.spyOn(studyStore, "getInitialState").mockReturnValue({
      ...initial,
      studyId: "study.waldzell-3",
      notYet: { kind: "can-be-done", serial: 1 },
    });
    surfaces.push(["the arena in a Study", renderToStaticMarkup(createElement(ArenaHud))]);
    surfaces.push(["the mirror's silence", renderToStaticMarkup(createElement(StudySilenceMirror))]);
    surfaces.push(["Leave", renderToStaticMarkup(createElement(LeaveStudy))]);

    for (const model of [PLATE_THREADS, PLATE_SILENCE, PLATE_LAST]) {
      surfaces.push([
        `the plate of ${model.studyId}`,
        renderToStaticMarkup(createElement(StudyPlateSurface, { model, reducedMotion: false })),
      ]);
    }

    expect(surfaces.length).toBeGreaterThan(50);
    for (const [name, html] of surfaces) {
      expect(spoken(html), name).not.toMatch(STUDY_FORBIDDEN);
    }
  });
});

describe("the first load", () => {
  it("never carries the Studies", () => {
    // `scripts/bundle-budgets.json`: the entry chunk has about 1.5 kB of
    // headroom, and the Studies travel with their own pages.
    for (const file of ["App.tsx", "ui/screens/TitleScreen.tsx"]) {
      const text = code(file);
      expect(text, file).not.toMatch(/from\s+["'][^"']*runtime\/studies["']/);
      expect(text, file).not.toMatch(/from\s+["'][^"']*content\/castalia\/studies["']/);
      expect(text, file).not.toMatch(/from\s+["'][^"']*screens\/(?:StudiesScreen|StudyPlate)["']/);
    }
    const app = code("App.tsx");
    // Both pages behind a dynamic import, and prefetched rather than waited for.
    expect(app).toContain('import("./ui/screens/StudiesScreen")');
    expect(app).toContain('import("./ui/screens/StudyPlate")');
    expect(app.match(/lazy\(/g)?.length).toBeGreaterThanOrEqual(5);
    expect(app).toContain('phase === "studies"');
    expect(app).toContain("plateOpen");
  });
});
