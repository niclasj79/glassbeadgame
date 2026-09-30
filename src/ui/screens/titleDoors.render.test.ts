import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openingWorld } from "@/scene/opening";
import { useStore } from "@/state/store";
import { installMotionDomStubs } from "../testing/domStubs";
import { TitleScreen } from "./TitleScreen";

/**
 * THE TITLE'S TWO DOORS (STUDIES-SPEC §7).
 *
 * The title renders both doors through the one `Button` primitive, so the
 * primitive is stood in for here by one that records what it was given: the
 * static render then says what is on the page, and the recorded props say what
 * pressing each door does — without a DOM, and without faking the title.
 */

interface RecordedButton {
  readonly children?: ReactNode;
  readonly variant?: string;
  readonly disabled?: boolean;
  readonly tabIndex?: number;
  readonly "aria-hidden"?: boolean;
  readonly "data-testid"?: string;
  readonly onClick?: () => void;
  readonly onPointerDown?: unknown;
}

const doors = vi.hoisted(() => ({ rendered: [] as RecordedButton[] }));

vi.mock("../components/Button", async () => {
  const react = await import("react");
  return {
    Button: (props: RecordedButton & Record<string, unknown>) => {
      doors.rendered.push(props);
      const { variant: _variant, ...rest } = props;
      return react.createElement("button", rest);
    },
  };
});

const render = (): string => renderToStaticMarkup(createElement(TitleScreen));

const studiesDoor = (): RecordedButton => {
  const door = doors.rendered.find((props) => props["data-testid"] === "title-studies");
  expect(door).toBeDefined();
  return door!;
};

describe("the title's second door", () => {
  beforeAll(installMotionDomStubs);
  beforeEach(() => {
    doors.rendered.length = 0;
    useStore.setState({ phase: "title" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState(useStore.getInitialState(), true);
  });

  it("stands beneath Begin, in the title's own register", () => {
    vi.spyOn(openingWorld, "isReady").mockReturnValue(true);
    const html = render();
    const begin = html.indexOf(">Begin</button>");
    const studies = html.indexOf('data-testid="title-studies"');
    expect(begin).toBeGreaterThan(-1);
    expect(studies).toBeGreaterThan(begin);
    expect(html).toMatch(/data-testid="title-studies"[^>]*>Studies<\/button>/);
    // The same primitive as Begin, one weight quieter.
    const [first, second] = doors.rendered;
    expect(first.children).toBe("Begin");
    expect(second.children).toBe("Studies");
    expect(second.variant).toBe("ghost");
    expect(first.variant).toBeUndefined();
  });

  it("is reachable by keyboard once the door is open, and held with Begin until then", () => {
    vi.spyOn(openingWorld, "isReady").mockReturnValue(true);
    render();
    const armed = studiesDoor();
    expect(armed.disabled).toBe(false);
    expect(armed.tabIndex).toBeUndefined();
    expect(armed["aria-hidden"]).toBeUndefined();
    // A click is the keyboard's door: Enter and Space on a button arrive as one.
    expect(typeof armed.onClick).toBe("function");

    vi.restoreAllMocks();
    vi.spyOn(openingWorld, "isReady").mockReturnValue(false);
    doors.rendered.length = 0;
    const held = render();
    const door = studiesDoor();
    expect(door.disabled).toBe(true);
    expect(door.tabIndex).toBe(-1);
    expect(door["aria-hidden"]).toBe(true);
    // Held exactly as Begin is held, and in its place, so nothing moves when it opens.
    const begin = doors.rendered.find((props) => props.children === "Begin")!;
    expect(begin.disabled).toBe(door.disabled);
    expect(held).toContain('data-testid="title-studies"');
  });

  it("opens the Studies, and a second press of either door is a no-op", () => {
    vi.spyOn(openingWorld, "isReady").mockReturnValue(true);
    render();
    const door = studiesDoor();
    door.onClick!();
    expect(useStore.getState().phase).toBe("studies");

    // Pressed once, the page is already on its way.
    useStore.setState({ phase: "title" });
    door.onClick!();
    expect(useStore.getState().phase).toBe("title");

    // And the latch is Begin's: once Begin is pressed, the second door is shut.
    doors.rendered.length = 0;
    render();
    const begin = doors.rendered.find((props) => props.children === "Begin")!;
    begin.onClick!();
    studiesDoor().onClick!();
    expect(useStore.getState().phase).toBe("title");
  });

  it("carries one word and nothing of the Studies behind it", () => {
    vi.spyOn(openingWorld, "isReady").mockReturnValue(true);
    const html = render();
    const block = html.slice(html.indexOf('<div class="mt-12 flex flex-col items-center"'));
    const text = block.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    // The doors, and nothing that counts, ranks, promises or lists a Study.
    expect(text).toBe("Begin Studies");
    expect(html).not.toMatch(/Eschholz|Waldzell|Vicus Lusorum|\bbrief\b/i);
  });
});
