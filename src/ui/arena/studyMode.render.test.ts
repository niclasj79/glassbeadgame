import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { studies } from "@/runtime/studies";
import { productionInterpretation } from "@/runtime/interpretation";
import { studyStore, type StudyStoreState } from "@/state/studies";
import { installMotionDomStubs } from "../testing/domStubs";
import { ArenaHud, LeaveStudy } from "./ArenaHud";
import { ColumnSurface, type ColumnSurfaceProps } from "./FocusColumn";
import { InterpretationControls, StudySilenceMirror } from "./InterpretationControls";
import { StudyNote } from "./StudyNote";
import { planColumn, type ColumnPlan } from "./columnPlan";
import { EMPTY_MARGIN, receive, type MarginState } from "./marginState";
import { holdWhileLeaving } from "./presence";
import {
  chapterNameOf,
  notYetLine,
  sessionPage,
  studyNote,
  type StudyNoteModel,
} from "./studyMode";
import { documentedCue, motifCue, relationFixture } from "./testing/cueFixtures";
import { byTestId, press } from "./testing/elementTree";
import { STUDY_FORBIDDEN, decode, spoken } from "./testing/studyFixtures";
import {
  COUNTERPOINT,
  FIBONACCI,
  GOLDEN_PAIR,
  focusView,
  heldView,
  lockedView,
  readingView,
  reopenedCue,
  roamingView,
} from "./testing/focusFixtures";

/**
 * THE ARENA IN STUDY MODE (STUDIES-SPEC §7), ON THE GLASS.
 *
 * The runtime's session verbs are mocked here and nowhere else; its listings
 * and briefs are the real ones, rendered by the domain from the authored
 * goals. A static render reads each store's initial state, so a Study is put
 * there for one render at a time rather than faked where a surface could see
 * it.
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

/** Whether a weave is being held, for the one test that needs one. */
const hold = vi.hoisted(() => ({ held: false }));

vi.mock("@/runtime/interpretation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/runtime/interpretation")>();
  return {
    ...actual,
    productionInterpretation: Object.freeze({
      ...actual.productionInterpretation,
      isHolding: () => hold.held || actual.productionInterpretation.isHolding(),
    }),
  };
});

const STUDY = "study.eschholz-1";
const BRIEF = studies.briefOf(STUDY);
const NOT_YET = "Not yet — it can be done with these beads.";

/** Put a Study (or none) in the Study store's initial state for the next static render. */
function playing(overrides: Partial<StudyStoreState>): void {
  const initial = studyStore.getInitialState();
  vi.spyOn(studyStore, "getInitialState").mockReturnValue({ ...initial, ...overrides });
}

const noop = (): void => undefined;

const surfaceProps = (
  plan: ColumnPlan,
  overrides: Partial<ColumnSurfaceProps> = {}
): ColumnSurfaceProps => ({
  plan,
  margin: EMPTY_MARGIN,
  hintShown: false,
  lensActive: false,
  reducedMotion: true,
  onCloseInspection: noop,
  onStepBack: noop,
  onSetAside: noop,
  onReopen: noop,
  onToggleIndex: noop,
  onReadMore: noop,
  onReadLess: noop,
  ...overrides,
});

const plan = (
  view: Parameters<typeof planColumn>[0]["view"],
  pinnedInspectId: string | null = null
): ColumnPlan => planColumn({ view, pinnedInspectId, lensActive: false });

const note = (overrides: Partial<StudyNoteModel> = {}): StudyNoteModel => ({
  ...studyNote(STUDY, null, true),
  ...overrides,
});

const renderColumn = (
  columnPlan: ColumnPlan,
  overrides: Partial<ColumnSurfaceProps> = {}
): string => renderToStaticMarkup(createElement(ColumnSurface, surfaceProps(columnPlan, overrides)));

/** The markup of the first element carrying `data-testid`, through its close. */
const element = (html: string, testId: string): string => {
  const open = new RegExp(`<(\\w+) [^>]*data-testid="${testId}"[^>]*>`).exec(html);
  expect(open).not.toBeNull();
  const tag = open![1];
  let depth = 0;
  const pattern = new RegExp(`<${tag}[\\s>]|</${tag}>`, "g");
  pattern.lastIndex = open!.index;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(open!.index, match.index + match[0].length);
  }
  return html.slice(open!.index);
};


/** The text of an element tree, for surfaces pressed rather than rendered. */
const textOf = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
};

/** The reading stack's content after the brief: what the Free Game writes on the same page. */
const afterNote = (html: string): string => {
  const stack = /<div class="pointer-events-none flex min-h-0[^"]*" data-mode="[^"]*">/.exec(html);
  expect(stack).not.toBeNull();
  const from = stack!.index + stack![0].length;
  const noteHtml = html.includes('data-testid="study-note"') ? element(html, "study-note") : "";
  const rest = html.slice(from);
  return noteHtml === "" ? rest : rest.slice(rest.indexOf(noteHtml) + noteHtml.length);
};

const COLUMN_STATES: ReadonlyArray<readonly [string, () => ColumnPlan, () => MarginState]> = [
  ["roaming", () => plan(roamingView()), () => EMPTY_MARGIN],
  [
    "roaming with a thread card",
    () => plan(roamingView()),
    () =>
      receive(
        EMPTY_MARGIN,
        documentedCue("established", "confirmed", relationFixture({ evidence: "established" }))
      ),
  ],
  ["a glance", () => plan(roamingView(FIBONACCI)), () => EMPTY_MARGIN],
  ["the gap", () => plan(focusView(FIBONACCI)), () => EMPTY_MARGIN],
  ["a sighted bead", () => plan(focusView(FIBONACCI, COUNTERPOINT)), () => EMPTY_MARGIN],
  ["a locked pair", () => plan(lockedView(GOLDEN_PAIR, "echo")), () => EMPTY_MARGIN],
  ["a chosen reading", () => plan(readingView("tension")), () => EMPTY_MARGIN],
  [
    "a reopened thread",
    () => plan(heldView()),
    () =>
      receive(
        receive(
          EMPTY_MARGIN,
          documentedCue("established", "confirmed", relationFixture({ evidence: "established" }))
        ),
        reopenedCue()
      ),
  ],
  ["a bead pinned open", () => plan(roamingView(FIBONACCI), String(COUNTERPOINT)), () => EMPTY_MARGIN],
  ["a motif", () => plan(roamingView()), () => receive(EMPTY_MARGIN, motifCue())],
];

describe("the arena in a Study", () => {
  beforeAll(installMotionDomStubs);
  beforeEach(() => {
    for (const verb of Object.values(verbs)) verb.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has no Conclude, no Lens and no Attunement invitation, and a quiet Leave", () => {
    playing({ studyId: STUDY });
    const html = renderToStaticMarkup(createElement(ArenaHud));
    expect(html).not.toContain("Conclude");
    expect(html).not.toContain("The Lens");
    expect(html).not.toContain("Close Lens");
    expect(html).not.toMatch(/attune|attunement/i);
    expect(html).not.toContain('data-testid="world-attunement"');
    const [leave] = html.match(/<button [^>]*data-testid="study-leave"[^>]*>[^<]*<\/button>/) ?? [];
    expect(leave).toBeDefined();
    expect(decode(leave!)).toContain(">Leave<");
    // In the arena's own corner, inside the chrome gate, like the verbs it replaces.
    expect(html.indexOf('data-testid="arena-chrome"')).toBeLessThan(html.indexOf("study-leave"));
    // The brief and both silence controls are on the page with it.
    expect(html).toContain('data-testid="study-brief"');
    expect(decode(element(html, "study-brief"))).toContain(BRIEF);
    expect(html).toContain('data-testid="study-declare-silence"');
    expect(html).toContain('data-testid="study-declare-silence-mirror"');
  });

  it("leaves for the Studies from its one verb", () => {
    press(byTestId(LeaveStudy(), "study-leave")[0]);
    expect(verbs.leave).toHaveBeenCalledTimes(1);
  });

  it("is the Free Game's HUD, with nothing of a Study, when no Study is played (R4)", () => {
    playing({ studyId: null });
    const html = renderToStaticMarkup(createElement(ArenaHud));
    expect(html).toContain("Conclude");
    expect(html).toContain("The Lens");
    expect(html).not.toMatch(/data-testid="study-/);
    expect(spoken(html)).not.toMatch(/cannot be done|brief|\bStudy\b|\bLeave\b|Not yet/);
    const mirror = renderToStaticMarkup(createElement(InterpretationControls));
    expect(mirror).not.toMatch(/data-testid="study-/);
    expect(spoken(mirror)).not.toMatch(/cannot be done/);
  });

  it("pins the brief above the focus view's cards in every column state", () => {
    const study = note();
    const notes = new Set<string>();
    for (const [name, columnPlan, margin] of COLUMN_STATES) {
      const html = renderColumn(columnPlan(), { margin: margin(), study });
      const brief = html.indexOf('data-testid="study-brief"');
      expect(brief, name).toBeGreaterThan(-1);
      expect(decode(element(html, "study-brief")), name).toContain(BRIEF);
      // The first note on the page: nothing of the column is written above it.
      for (const later of [
        "focus-card-top",
        "focus-card-second",
        "focus-gap",
        "focus-reading",
        "focus-step-back",
        "bead-inspect",
        "marginalia",
        "margin-plate",
      ]) {
        const at = html.indexOf(`data-testid="${later}"`);
        if (at > -1) expect(brief, `${name}: ${later}`).toBeLessThan(at);
      }
      notes.add(element(html, "study-note"));
    }
    // And the same note in every state, so the cards arriving and leaving
    // beneath it can never move it, and it never moves them.
    expect(notes.size).toBe(1);
  });

  it("leaves the focus view's cards, the thread card and motif notes exactly as the Free Game writes them", () => {
    for (const [name, columnPlan, margin] of COLUMN_STATES) {
      const free = renderColumn(columnPlan(), { margin: margin() });
      const inStudy = renderColumn(columnPlan(), { margin: margin(), study: note() });
      expect(afterNote(inStudy), name).toBe(afterNote(free));
    }
  });

  it("keeps the brief on the page in the arena's own column, from the Study store", () => {
    playing({ studyId: STUDY });
    const html = renderToStaticMarkup(createElement(ArenaHud));
    const column = element(html, "focus-column");
    expect(column).toContain('data-testid="study-note"');
    expect(decode(column)).toContain("Study · Eschholz");
  });

  it("can be set aside and reopened by one control that keeps its place", () => {
    const toggled: string[] = [];
    const open = renderToStaticMarkup(
      createElement(StudyNote, { note: note(), reducedMotion: true, onToggleBrief: noop })
    );
    expect(open).toMatch(/data-testid="study-brief-toggle"[^>]*aria-expanded="true"[^>]*>Set aside</);

    const folded = renderToStaticMarkup(
      createElement(StudyNote, { note: note({ open: false }), reducedMotion: true, onToggleBrief: noop })
    );
    expect(folded).not.toContain('data-testid="study-brief"');
    const toggle = element(folded, "study-brief-toggle");
    expect(toggle).toContain('aria-expanded="false"');
    // Set aside, never gone: the control that reopens it names the brief.
    expect(decode(toggle)).toContain(`The brief · ${BRIEF}`);
    // The silence control stays, first, beneath where the brief stood.
    expect(folded.indexOf("study-declare-silence")).toBeLessThan(folded.indexOf("study-brief-toggle"));

    for (const state of [note(), note({ open: false })]) {
      const tree = StudyNote({
        note: state,
        reducedMotion: true,
        onToggleBrief: () => toggled.push(state.open ? "set aside" : "reopen"),
      });
      press(byTestId(tree, "study-brief-toggle")[0]);
    }
    expect(toggled).toEqual(["set aside", "reopen"]);
  });

  it("declares silence from the margin, under the brief", () => {
    const tree = StudyNote({ note: note(), reducedMotion: true, onToggleBrief: noop });
    const [control] = byTestId(tree, "study-declare-silence");
    expect(textOf(control)).toBe("It cannot be done");
    press(control);
    expect(verbs.declareSilence).toHaveBeenCalledTimes(1);
    // Beneath the brief, and the first control there.
    const html = renderToStaticMarkup(
      createElement(StudyNote, { note: note(), reducedMotion: true, onToggleBrief: noop })
    );
    expect(html.indexOf("study-brief")).toBeLessThan(html.indexOf("study-declare-silence"));
  });

  it("declares silence from the accessible mirror, on every Study", () => {
    const [control] = byTestId(StudySilenceMirror(), "study-declare-silence-mirror");
    expect(textOf(control)).toBe("It cannot be done");
    press(control);
    expect(verbs.declareSilence).toHaveBeenCalledTimes(1);

    for (const studyId of studies.chapters().flatMap((chapter) => chapter.studies.map((s) => s.id))) {
      playing({ studyId });
      const html = renderToStaticMarkup(createElement(InterpretationControls));
      expect(html, studyId).toContain('data-testid="study-declare-silence-mirror"');
      // Inside the mirror, which is never drawn.
      expect(html.indexOf('class="sr-only"'), studyId).toBeLessThan(
        html.indexOf("study-declare-silence-mirror")
      );
      vi.restoreAllMocks();
    }
  });

  it("never interrupts a weave being held", () => {
    hold.held = true;
    try {
      expect(productionInterpretation.isHolding()).toBe(true);
      press(byTestId(StudySilenceMirror(), "study-declare-silence-mirror")[0]);
      press(
        byTestId(
          StudyNote({ note: note(), reducedMotion: true, onToggleBrief: noop }),
          "study-declare-silence"
        )[0]
      );
      expect(verbs.declareSilence).not.toHaveBeenCalled();
    } finally {
      hold.held = false;
    }
  });

  it("writes not yet as a margin line, never a plate, and writes it again for each answer", () => {
    const before = renderToStaticMarkup(
      createElement(StudyNote, { note: note(), reducedMotion: true, onToggleBrief: noop })
    );
    expect(before).not.toContain('data-testid="study-not-yet"');

    const first = note({ notYet: { serial: 1, line: notYetLine("can-be-done") } });
    const html = renderToStaticMarkup(
      createElement(StudyNote, { note: first, reducedMotion: true, onToggleBrief: noop })
    );
    const line = element(html, "study-not-yet");
    expect(decode(line)).toContain(NOT_YET);
    expect(html).not.toContain("study-plate");
    // Under the control, not over the brief.
    expect(html.indexOf("study-declare-silence")).toBeLessThan(html.indexOf("study-not-yet"));
    // What the eye reads. The ear is told once, by the world's voice
    // (`studyVoice.test.ts`), so the margin is no live region of its own and
    // nothing is said twice.
    expect(html).not.toMatch(/aria-live|role="status"|role="alert"/);

    // The same words a second time are a second answer: a new element, keyed by its serial.
    const keyOf = (serial: number): string | null =>
      byTestId(
        StudyNote({
          note: note({ notYet: { serial, line: notYetLine("can-be-done") } }),
          reducedMotion: true,
          onToggleBrief: noop,
        }),
        "study-not-yet"
      )[0]?.key ?? null;
    expect(keyOf(1)).not.toBeNull();
    expect(keyOf(2)).not.toBe(keyOf(1));
  });

  it("reads not yet from the Study store into the arena's margin", () => {
    playing({ studyId: STUDY, notYet: { kind: "can-be-done", serial: 3 } });
    const html = renderToStaticMarkup(createElement(ArenaHud));
    expect(decode(element(html, "study-not-yet"))).toContain(NOT_YET);
    expect(html).not.toContain('data-testid="study-plate"');
  });

  it("takes the words of not yet from the domain's one renderer", () => {
    expect(notYetLine("can-be-done")).toBe(NOT_YET);
    expect(notYetLine("no-answer-yet")).toBe("Not yet.");
  });

  it("names the chapter and never a place in an order", () => {
    const chapters = studies.chapters();
    expect(chapterNameOf(chapters, "study.eschholz-4")).toBe("Eschholz");
    expect(chapterNameOf(chapters, "study.waldzell-2")).toBe("Waldzell");
    expect(chapterNameOf(chapters, "study.vicus-lusorum-3")).toBe("Vicus Lusorum");
    expect(chapterNameOf(chapters, "study.nowhere-1")).toBeNull();
    expect(note().chapter).toBe("Eschholz");
    expect(note().brief).toBe(BRIEF);
  });

  it("leaves as a Study's page, never redrawn as a Free Game on the way out", () => {
    // Leaving forgets the Study in the same act that changes the phase, and
    // the page fades after both. Each surface that reads the Study store reads
    // it through the hold, so the fade keeps what the page showed.
    const code = (path: string): string =>
      readFileSync(join(process.cwd(), "src", ...path.split("/")), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    const reads = (source: string): string[] => source.match(/useStudy\(/g) ?? [];
    const held = (source: string): string[] => source.match(/useHeldWhileLeaving\(useStudy\(/g) ?? [];
    for (const file of [
      "ui/arena/ArenaHud.tsx",
      "ui/arena/FocusColumn.tsx",
      "ui/arena/InterpretationControls.tsx",
      "ui/screens/StudyPlate.tsx",
    ]) {
      const source = code(file);
      expect(reads(source).length, file).toBeGreaterThan(0);
      expect(held(source), file).toHaveLength(reads(source).length);
    }
    // And the column's key with it, so a fading page is not remounted empty.
    expect(code("ui/arena/ArenaHud.tsx")).toContain(
      "useHeldWhileLeaving(useStore((state) => state.session))"
    );
  });

  it("follows the stores while present and keeps its last word while leaving", () => {
    const held = { current: "a Study" as string | null };
    expect(holdWhileLeaving(held, "a Study", true)).toBe("a Study");
    expect(holdWhileLeaving(held, "the next Study", true)).toBe("the next Study");
    // Leaving: the Study store is emptied, and the page still shows its Study.
    expect(holdWhileLeaving(held, null, false)).toBe("the next Study");
    expect(holdWhileLeaving(held, null, false)).toBe("the next Study");
    // Present again, it follows at once.
    expect(holdWhileLeaving(held, null, true)).toBeNull();
  });

  it("opens every new Study session on a new page", () => {
    const first = {};
    const again = {};
    expect(sessionPage(null)).toBe(0);
    expect(sessionPage(first)).toBe(sessionPage(first));
    expect(sessionPage(again)).not.toBe(sessionPage(first));
    expect(sessionPage(first)).toBeGreaterThan(0);
  });

  it("puts nothing on the arena that counts, totals or judges", () => {
    const surfaces = [
      renderToStaticMarkup(createElement(LeaveStudy)),
      renderToStaticMarkup(createElement(StudySilenceMirror)),
    ];
    for (const study of studies.chapters().flatMap((chapter) => chapter.studies)) {
      for (const state of [
        studyNote(study.id, null, true),
        studyNote(study.id, null, false),
        studyNote(study.id, { kind: "can-be-done", serial: 7 }, true),
        studyNote(study.id, { kind: "no-answer-yet", serial: 8 }, false),
      ]) {
        surfaces.push(
          renderToStaticMarkup(
            createElement(StudyNote, { note: state, reducedMotion: false, onToggleBrief: noop })
          )
        );
      }
    }
    playing({ studyId: STUDY, notYet: { kind: "can-be-done", serial: 1 } });
    surfaces.push(renderToStaticMarkup(createElement(ArenaHud)));
    for (const html of surfaces) expect(spoken(html)).not.toMatch(STUDY_FORBIDDEN);
  });
});
