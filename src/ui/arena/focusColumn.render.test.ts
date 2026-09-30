import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { castaliaConceptById } from "@/content/castalia";
import { installMotionDomStubs } from "../testing/domStubs";
import { ColumnSurface, type ColumnSurfaceProps } from "./FocusColumn";
import {
  GAP_HINT,
  GAP_HINT_DELAY_MS,
  NOTHING_SHARED,
  createGapHint,
  planColumn,
  type ColumnPlan,
} from "./columnPlan";
import { EMPTY_MARGIN, receive, type MarginState } from "./marginState";
import { documentedCue, relationFixture } from "./testing/cueFixtures";
import { byTestId, press } from "./testing/elementTree";
import {
  COUNTERPOINT,
  FIBONACCI,
  GOLDEN_PAIR,
  UNSHARED_PAIR,
  focusView,
  heldView,
  lockedView,
  readingView,
  reopenedCue,
  roamingView,
} from "./testing/focusFixtures";

/**
 * THE COLUMN ON THE GLASS, IN EVERY STATE OF THE FOCUS VIEW (I-015 … I-019).
 *
 * `ColumnSurface` is the column with no store attached, planned from real
 * views by the real `deriveFocusView`, so what each state puts on the page can
 * be read, and what each control does can be pressed.
 */

const noop = (): void => undefined;

const props = (
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
  pinnedInspectId: string | null = null,
  lensActive = false
): ColumnPlan => planColumn({ view, pinnedInspectId, lensActive });

const render = (columnPlan: ColumnPlan, overrides: Partial<ColumnSurfaceProps> = {}): string =>
  renderToStaticMarkup(createElement(ColumnSurface, props(columnPlan, overrides)));

/** The opening tag of every element carrying `data-testid`. */
const tags = (html: string, testId: string): string[] =>
  html.match(new RegExp(`<\\w+ [^>]*data-testid="${testId}"[^>]*>`, "g")) ?? [];

const attribute = (tag: string, name: string): string | null =>
  new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

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

const decode = (text: string): string =>
  text
    .split("&quot;")
    .join('"')
    .split("&#x27;")
    .join("'")
    .split("&lt;")
    .join("<")
    .split("&gt;")
    .join(">")
    .split("&amp;")
    .join("&");

/** Everything a reader can be told: the text, and every accessible name and gloss. */
const spoken = (html: string): string =>
  decode(
    [
      html.replace(/<[^>]*>/g, " "),
      ...[...html.matchAll(/(?:aria-label|title)="([^"]*)"/g)].map((match) => match[1]),
    ].join(" ")
  );

const FIB = castaliaConceptById.get(String(FIBONACCI))!;
const CP = castaliaConceptById.get(String(COUNTERPOINT))!;

describe("the column of the focus view", () => {
  beforeAll(installMotionDomStubs);
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is one column, whatever it holds", () => {
    for (const columnPlan of [
      plan(roamingView()),
      plan(roamingView(FIBONACCI)),
      plan(focusView()),
      plan(focusView(FIBONACCI, COUNTERPOINT)),
      plan(lockedView(GOLDEN_PAIR, "echo")),
      plan(heldView()),
      plan(roamingView(FIBONACCI), String(COUNTERPOINT)),
    ]) {
      const html = render(columnPlan);
      expect(tags(html, "focus-column")).toHaveLength(1);
      // One page, one landmark: no surface draws a column of its own over it.
      expect(html.match(/role="region"/g)).toHaveLength(1);
      expect(html.match(/data-testid="reading-column-standing"/g)).toHaveLength(1);
    }
  });

  it("opens a dwelt-on bead's whole card at the top while roaming (I-015)", () => {
    const html = render(plan(roamingView(FIBONACCI)));
    const [top] = tags(html, "focus-card-top");
    expect(attribute(top, "data-role")).toBe("dwell");
    expect(attribute(top, "data-concept-id")).toBe(FIB.id);
    // The same authored content as the pinned card: faculty · kind, name,
    // caption, description, facets and dates.
    const card = decode(element(html, "focus-card-top"));
    for (const line of [FIB.name, FIB.caption, FIB.description, FIB.era, "Measure", FIB.kind]) {
      expect(card).toContain(line);
    }
    expect(card).toContain('data-testid="bead-facets"');
    // A glance: nothing to press, and transparent to the pointer, so it can
    // never sit between the player and the arena.
    expect(card).not.toContain('data-testid="bead-close"');
    expect(card).not.toContain("tabindex");
    expect(attribute(top, "class")?.split(/\s+/)).toContain("pointer-events-none");
    // And it closes with the dwell: the next roaming view has no card.
    expect(render(plan(roamingView()))).not.toContain('data-testid="focus-card-top"');
  });

  it("lets a glance hold the page without closing the reading beneath it", () => {
    const margin = receive(
      EMPTY_MARGIN,
      documentedCue("established", "confirmed", relationFixture({ evidence: "established" }))
    );
    const glancing = render(plan(roamingView(FIBONACCI)), { margin });
    expect(glancing).toContain('data-testid="focus-card-top"');
    // Not drawn while the look lasts, so it is never pushed down the page…
    expect(glancing).not.toContain('data-testid="margin-plate"');
    // …and back in place, still open, the moment the dwell ends.
    const after = render(plan(roamingView()), { margin });
    expect(after).toContain('data-testid="margin-plate"');
    expect(after).toContain("The Most Rational and the Least");
  });

  it("gives way to a pinned card, which wins over a glance", () => {
    const html = render(plan(roamingView(FIBONACCI), String(COUNTERPOINT)));
    expect(html).not.toContain('data-testid="focus-card-top"');
    expect(html).toContain('data-testid="bead-inspect"');
    expect(html).toContain('data-testid="bead-plate"');
    expect(decode(element(html, "bead-plate"))).toContain(CP.description);
    expect(html).toContain('data-testid="bead-close"');
    // The margin stands down while a card the player asked for holds the page.
    expect(html).not.toContain('data-testid="marginalia"');
  });

  it("locks the attended card at the top and opens the gap beneath it (I-018)", () => {
    const html = render(plan(focusView(FIBONACCI)));
    const [top] = tags(html, "focus-card-top");
    expect(attribute(top, "data-role")).toBe("attended");
    expect(attribute(top, "data-concept-id")).toBe(FIB.id);
    const card = decode(element(html, "focus-card-top"));
    // Compact: faculty · kind, name, caption, facets — no description, no dates.
    for (const line of [FIB.name, FIB.caption, "Measure", FIB.kind]) {
      expect(card).toContain(line);
    }
    expect(card).not.toContain(FIB.description);
    expect(card).not.toContain(FIB.era);
    // The gap: an empty outline, and no line in it yet.
    expect(html).toContain('data-testid="focus-gap"');
    expect(attribute(tags(html, "focus-gap")[0], "class")).toContain("border-dashed");
    expect(html).not.toContain('data-testid="focus-gap-hint"');
    expect(html).not.toContain('data-testid="focus-card-second"');
    // The column is about the pair: nothing of the margin, and a visible way back.
    expect(html).not.toContain('data-testid="marginalia"');
    expect(html).toContain('data-testid="focus-step-back"');
  });

  it("says what the gap is for only after three seconds of hesitation (I-013)", () => {
    vi.useFakeTimers();
    let shown = false;
    const hint = createGapHint((value) => {
      shown = value;
    });
    const focus = plan(focusView(FIBONACCI));
    hint.observe(String(FIBONACCI));

    expect(render(focus, { hintShown: shown })).not.toContain('data-testid="focus-gap-hint"');
    vi.advanceTimersByTime(GAP_HINT_DELAY_MS - 1);
    expect(render(focus, { hintShown: shown })).not.toContain('data-testid="focus-gap-hint"');

    vi.advanceTimersByTime(1);
    const html = render(focus, { hintShown: shown });
    expect(html).toContain('data-testid="focus-gap-hint"');
    expect(decode(element(html, "focus-gap"))).toContain(GAP_HINT);

    // A sighted bead fills the gap and the line goes with it.
    hint.observe(null);
    expect(shown).toBe(false);
    const sighted = render(plan(focusView(FIBONACCI, COUNTERPOINT)), { hintShown: shown });
    expect(sighted).not.toContain('data-testid="focus-gap"');
    expect(sighted).not.toContain(GAP_HINT);
    hint.dispose();
  });

  it("fills the gap with the sighted bead and lights what both carry, in both cards", () => {
    const html = render(plan(focusView(FIBONACCI, COUNTERPOINT)));
    const [second] = tags(html, "focus-card-second");
    expect(attribute(second, "data-role")).toBe("sighted");
    expect(attribute(second, "data-concept-id")).toBe(CP.id);
    expect(decode(element(html, "focus-card-second"))).toContain(CP.caption);

    const lit = tags(html, "focus-shared-facets");
    expect(lit).toHaveLength(2);
    for (const card of ["focus-card-top", "focus-card-second"]) {
      const group = element(element(html, card), "focus-shared-facets");
      expect(decode(group)).toContain("Recursion");
      // Lit is said in weight and in a mark, never in colour alone.
      expect(group).toContain("font-semibold");
      expect(group).toContain("✦");
      expect(group).toContain('data-shared="true"');
      // Only what both carry is lit.
      expect(decode(group)).not.toContain("Proportion");
      expect(decode(group)).not.toContain("Imitation");
    }
    // Nothing unlit carries the mark.
    expect(html.match(/data-shared="true"/g)).toHaveLength(2);
    expect(html).not.toContain('data-testid="focus-nothing-shared"');
  });

  it("says plainly when the two share nothing", () => {
    const [a, b] = UNSHARED_PAIR;
    for (const columnPlan of [plan(focusView(a, b)), plan(lockedView(UNSHARED_PAIR))]) {
      const html = render(columnPlan);
      expect(html).toContain('data-testid="focus-nothing-shared"');
      expect(decode(element(html, "focus-nothing-shared"))).toContain(NOTHING_SHARED);
      expect(html).not.toContain('data-testid="focus-shared-facets"');
    }
  });

  it("keeps both cards when the pair is locked, and names only the reading heard", () => {
    const quiet = render(plan(lockedView()));
    expect(attribute(tags(quiet, "focus-card-top")[0], "data-role")).toBe("attended");
    expect(attribute(tags(quiet, "focus-card-second")[0], "data-role")).toBe("candidate");
    expect(quiet).not.toContain('data-testid="focus-reading"');

    const heard = render(plan(lockedView(GOLDEN_PAIR, "echo")));
    const line = decode(element(heard, "focus-reading"));
    expect(line).toContain("Echo — shares a form");
    // One line, one reading: the other three are never named beside it.
    for (const other of ["Passage", "Tension", "Ground"]) expect(line).not.toContain(other);

    const chosen = render(plan(readingView("tension")));
    expect(decode(element(chosen, "focus-reading"))).toContain(
      "Tension — opposes or complicates"
    );
  });

  it("holds a reopened thread: both bead cards and the thread's own card (I-019)", () => {
    const margin: MarginState = receive(
      receive(EMPTY_MARGIN, documentedCue("established", "confirmed", relationFixture({ evidence: "established" }))),
      reopenedCue()
    );
    const html = render(plan(heldView()), { margin });
    expect(attribute(tags(html, "focus-card-top")[0], "data-role")).toBe("held");
    expect(attribute(tags(html, "focus-card-second")[0], "data-role")).toBe("held");
    expect(tags(html, "focus-shared-facets")).toHaveLength(2);
    const [plate] = tags(html, "margin-plate");
    expect(attribute(plate, "data-thread-id")).toBe("thread:1:s:1");
    expect(decode(element(html, "margin-plate"))).toContain("The Most Rational and the Least");
    // The held card is read, and left with the column's own Step back.
    expect(html).toContain('data-testid="focus-step-back"');
    expect(html).not.toContain('data-testid="margin-set-aside"');
    expect(html).not.toContain('data-testid="margin-index-toggle"');
  });

  it("opens a pinned bead of the pair in full where it stands", () => {
    const html = render(plan(lockedView(), String(FIBONACCI)));
    const [top] = tags(html, "focus-card-top");
    expect(attribute(top, "data-detail")).toBe("full");
    expect(decode(element(html, "focus-card-top"))).toContain(FIB.description);
    expect(element(html, "focus-card-top")).toContain('data-testid="bead-close"');
    expect(attribute(tags(html, "focus-card-second")[0], "data-detail")).toBe("compact");
    // Still lit in both.
    expect(tags(html, "focus-shared-facets")).toHaveLength(2);
  });

  it("steps back one stage from its own control, and sets a pinned card aside", () => {
    const steps: string[] = [];
    const tree = ColumnSurface(
      props(plan(lockedView(), String(FIBONACCI)), {
        onStepBack: () => steps.push("step back"),
        onCloseInspection: () => steps.push("set aside"),
      })
    );
    press(byTestId(tree, "focus-step-back")[0]);
    press(byTestId(tree, "bead-close")[0]);
    expect(steps).toEqual(["step back", "set aside"]);
  });

  it("lets the Lens keep the page, drawing only a bead being looked at", () => {
    expect(render(plan(roamingView(), null, true), { lensActive: true })).toBe("");
    const lens = render(plan(roamingView(FIBONACCI), null, true), { lensActive: true });
    expect(lens).toContain('data-testid="focus-card-top"');
    expect(lens).toContain("Lens focus");
    expect(lens).not.toContain('data-testid="marginalia"');
  });

  it("writes nothing that counts, ranks, scores or anticipates the record before a commit", () => {
    const FORBIDDEN =
      /\d|%|\bscore|\bpoints?\b|\brank|\bwrong\b|\bcorrect|\bdocumented\b|\brecord\b|\bresonan|\bband\b|\blikely\b|\brecommend|\bprefer/i;
    const [a, b] = UNSHARED_PAIR;
    for (const columnPlan of [
      plan(focusView(FIBONACCI)),
      plan(focusView(FIBONACCI, COUNTERPOINT)),
      plan(focusView(a, b)),
      plan(lockedView()),
      plan(lockedView(UNSHARED_PAIR)),
      plan(lockedView(GOLDEN_PAIR, "echo")),
      plan(readingView("passage")),
      plan(readingView("ground", UNSHARED_PAIR)),
    ]) {
      const text = spoken(render(columnPlan, { hintShown: true }));
      expect(text).not.toMatch(FORBIDDEN);
    }
  });
});
