import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { RELATION_INTENTIONS } from "@/domain/events";
import { STATION_SIZE, UTILITY_SIZE, plateGeometry } from "./framing";

/**
 * The plate's own geometry is pure and is tested as such — but the module it
 * lives in pulls in three and drei, which read a browser out of the global
 * scope as they load. The unit environment here is node with a hand-built
 * `navigator`, so it is completed before the module is asked for.
 */
const browserish = {
  hardwareConcurrency: 8,
  userAgent: "vitest",
  maxTouchPoints: 0,
};
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: browserish,
});
Object.assign(globalThis.window as unknown as Record<string, unknown>, {
  navigator: browserish,
  devicePixelRatio: 1,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});

let plateModule: typeof import("./IntentionConstellation");
beforeAll(async () => {
  plateModule = await import("./IntentionConstellation");
});

/**
 * GAP-12 and IMP-3 — WHAT THE PLATE IS AIMED AT, AND WHAT IT SITS ON
 *
 * Both were measured against the running build at 1280x720, seed
 * castalia-golden-001, with Fibonacci Sequence attended.
 *
 * GAP-12. The plate appeared 18 ms after the press at (170, 201), was carried
 * to (-18, 258) — more than half of it off the left edge of the viewport — and
 * only came to rest at (423, 293) after three and a half seconds, 294 px from
 * where it opened and 622 px along its path. Everything the player could aim at
 * was travelling for the whole of that, because attending performs a camera
 * lean and the plate is anchored to a bead in the world.
 *
 * IMP-3. The Prime Numbers bead sat 53 px from the attended bead — inside the
 * 86 px graduated ring, and 33 px from the centre of the Ground station, whose
 * own hit box is 48 px across. The ring's engraving ran straight through it.
 * And the two utilities were 44 px chips against the verbs' 48 px, with the
 * same rule, the same fill and the same blur: six near-identical discs of which
 * four were the interpretation and two were housekeeping.
 */

const source = (): string =>
  readFileSync(new URL("./IntentionConstellation.tsx", import.meta.url), "utf8");

/** Source with comments removed — prose about a rule is not the rule. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");

describe("the intention plate", () => {
  it("opens in the pose it will be aimed at, not while the camera travels", () => {
    const text = source();
    // The gate itself, and the only thing that opens it.
    expect(text).toContain("frameState.cameraSettled");
    expect(text).toMatch(/if \(!posed\) return <group ref=\{anchor\} \/>;/);
    // Latched: once open it may not be taken away again by a later phrase —
    // the breath on choosing would otherwise close the plate mid-reading. It
    // is re-placed only when the pair itself changes (a re-lock).
    expect(text).toMatch(/if \(!posed\) \{[\s\S]{0,320}setPosed\(true\)/);
    expect(text).toMatch(/\}, \[pairKey\]\);/);
  });

  it("waits for the hand that locked the pair to let go before it counts a pose", () => {
    // A press holds the sightline, and a held camera reports itself settled:
    // without this the plate would open in the frozen pose and then be carried
    // off by the framing the lock asked for.
    const text = code(source());
    expect(text).toContain("isSightlineHeld()");
    expect(text).toMatch(/if \(sightlineHeld\) \{[\s\S]{0,160}return false;/);
  });

  it("waits more than one frame, because the flag it reads is a frame old", () => {
    // `CameraRig` writes `cameraSettled` from its own frame callback and this
    // component's runs first, so on the frame an attend is committed the flag
    // still carries the previous frame's answer. Reading it once would open the
    // plate exactly where the defect wanted it.
    const text = source();
    expect(text).toMatch(/POSE_SETTLE_FRAMES = ([2-9]|\d\d)/);
    expect(text).toContain("settledFrames.current >= POSE_SETTLE_FRAMES");
  });

  /**
   * B2. The press that demands the plate was answered by nothing for about
   * three and a half seconds, because the plate waited for a camera lean whose
   * whole purpose was to make room for it. The press now holds the sightline
   * and the plate opens in place — so keeping it on the page is the plate's own
   * job, and it has to be able to do it on a phone, where the page is smaller
   * than the plate.
   */
  describe("the plate keeps itself on the page", () => {
    const plate = plateGeometry(414, true);

    it("slides by the least it can, and not at all when it fits", () => {
      expect(plateModule.PLATE_PLACEMENT.slide(640, 157, 1280)).toBe(0);
      // A bead 149 px from the top of a 720 px page: the measured Fibonacci
      // case, 8 px of plate over the edge.
      expect(plateModule.PLATE_PLACEMENT.slide(149, 157, 720)).toBeCloseTo(8, 6);
      expect(plateModule.PLATE_PLACEMENT.slide(644, 157, 720)).toBeCloseTo(-81, 6);
      // A page that cannot hold the plate on this axis at all is not made worse
      // by carrying it off the opposite edge.
      expect(plateModule.PLATE_PLACEMENT.slide(200, 300, 414)).toBe(0);
    });

    it("stops at the ring, so the plate is still visibly this bead's", () => {
      // 130 px of correction wanted, on a plate whose ring is 80.
      expect(plateModule.PLATE_PLACEMENT.bounded(130, 0, plate.ring)).toBe(plate.ring);
      expect(plateModule.PLATE_PLACEMENT.bounded(-130, 0, plate.ring)).toBe(-plate.ring);
      expect(plateModule.PLATE_PLACEMENT.bounded(12, 0, plate.ring)).toBe(12);
    });

    it("gives that bound up only for a verb over the edge of the page", () => {
      // The one thing that may never happen: a station off the page is a verb
      // the player cannot reach.
      expect(plateModule.PLATE_PLACEMENT.bounded(130, 104, plate.ring)).toBe(104);
      expect(plateModule.PLATE_PLACEMENT.bounded(130, -104, plate.ring)).toBe(104);
    });

    it("keeps every verb on a phone, for a bead pressed against the edge", () => {
      const width = 414;
      const verb = plate.ring + plate.station / 2 + 18;
      for (let x = 8; x < width; x += 7) {
        const dx = plateModule.PLATE_PLACEMENT.bounded(
          plateModule.PLATE_PLACEMENT.slide(x, plate.extentSide, width),
          plateModule.PLATE_PLACEMENT.slide(x, verb, width),
          plate.ring
        );
        const centre = x + dx;
        expect(centre - verb).toBeGreaterThanOrEqual(-1e-6);
        expect(centre + verb).toBeLessThanOrEqual(width + 1e-6);
      }
    });
  });

  /**
   * …and the other half of B2: at T+90.7 the ring was still open, sixty-five
   * seconds after the release, with no thread woven and nothing changing.
   */
  describe("an armed intention that nobody draws", () => {
    it("says nothing at all for a good while", () => {
      expect(plateModule.PLATE_PLACEMENT.insistence(0)).toBe(0);
      expect(plateModule.PLATE_PLACEMENT.insistence(plateModule.INSIST_AFTER_SECONDS - 0.01)).toBe(0);
      // No timer, no countdown, no failure: the wait is long enough that a
      // player who is thinking is never interrupted.
      expect(plateModule.INSIST_AFTER_SECONDS).toBeGreaterThanOrEqual(8);
    });

    it("then insists, continuously, and never becomes a flash", () => {
      expect(plateModule.PLATE_PLACEMENT.insistence(plateModule.INSIST_AFTER_SECONDS + 2.5)).toBeCloseTo(0.5, 6);
      expect(plateModule.PLATE_PLACEMENT.insistence(1000)).toBe(1);
      let previous = 0;
      for (let t = 0; t <= 30; t += 0.25) {
        const now = plateModule.PLATE_PLACEMENT.insistence(t);
        expect(now).toBeGreaterThanOrEqual(previous);
        expect(now - previous).toBeLessThan(0.1);
        previous = now;
      }
      // Light, bounded, on the world's own breath — not a blink.
      expect(plateModule.INSIST_DEPTH).toBeLessThan(0.5);
      const text = source();
      expect(text).toContain("frameState.breathPhase");
      expect(text).toContain("mark.style.opacity");
    });
  });

  it("clears a radius rather than being struck over the beads inside it", () => {
    const text = source();
    // A ground of the world's own colour, drawn before the engraving so the
    // engraving is not dimmed by it.
    expect(text).toContain("radialGradient");
    expect(text).toContain('data-testid="intention-plate-ground"');
    const ground = text.indexOf('data-testid="intention-plate-ground"');
    const engraved = text.indexOf("stroke={rule}");
    expect(ground).toBeGreaterThan(-1);
    expect(ground).toBeLessThan(engraved);
    // Transparent where the attended bead is: the plate dims its neighbours,
    // never its subject.
    expect(text).toMatch(/offset="0%"[\s\S]{0,80}stopOpacity=\{0\}/);
  });

  it("keeps the preview thread legible through its own centre", () => {
    // The thread runs straight through the plate and is the thing being heard,
    // so the ground is a band under the engraving and clear at the middle.
    const text = source();
    expect(text).toMatch(/offset="58%"[\s\S]{0,80}stopOpacity=\{0\}/);
  });

  it("draws the two utilities as a smaller, quieter class than the verbs", () => {
    const text = source();
    // The mark is materially smaller than a verb station …
    const mark = /h-\[(\d+)px\] w-\[(\d+)px\]/.exec(text);
    expect(mark).not.toBeNull();
    const drawn = Number(mark![1]);
    expect(drawn).toBeLessThan(STATION_SIZE * 0.7);
    // … and does not carry the verb's fill, shadow or blur.
    expect(text).not.toMatch(
      /world-cancel-interpretation[\s\S]{0,600}shadow-\[/
    );
    expect(text).not.toMatch(
      /world-cancel-interpretation[\s\S]{0,600}backdrop-blur/
    );
    // The *target* is untouched: the clearance law in framing.ts is measured
    // against a fingertip, and shrinking a hit box to make a hierarchy read is
    // how two targets become one.
    expect(text).toContain("...utilitySize");
    const plate = plateGeometry(1280, false);
    expect(plate.utility).toBe(UTILITY_SIZE);
    expect(drawn).toBeLessThan(plate.utility);
  });
});

/**
 * I-016 — THE SIGILS BLOOM ON THE THREAD BETWEEN THE PAIR.
 *
 * They used to ring the attended bead and ask for a verb before the object
 * existed. The plate now stands halfway along the unread strand between the
 * locked pair, appears exactly when the focus view says the sigils are
 * visible, and gives all four readings the same hands.
 */
describe("the sigils on the preview thread", () => {
  it("anchors the plate between the pair, not on the attended bead", () => {
    const text = code(source());
    expect(text).toContain("previewMidpoint(attendedAt, secondAt, midpoint)");
    expect(text).toContain("anchor.current.position.copy(midpoint)");
    expect(text).not.toMatch(/anchor\.current\.position\.set\(/);
  });

  it("appears exactly when the focus view says the sigils are visible", () => {
    const text = code(source());
    expect(text).toContain("useFocusView()");
    expect(text).toContain("view.sigilsVisible ? view.attendedConceptId : null");
    expect(text).toContain("view.sigilsVisible ? view.secondConceptId : null");
  });

  it("stands the four readings in one fixed order, whatever the pair", () => {
    expect(plateModule.INTENTION_OPTIONS.map((option) => option.intention)).toEqual([
      ...RELATION_INTENTIONS,
    ]);
    expect(plateModule.INTENTION_OPTIONS.map((option) => option.station)).toEqual([
      "north",
      "east",
      "south",
      "west",
    ]);
  });

  it("gives every sigil the same hands and marks none of them by fit", () => {
    const text = code(source());
    expect(text).toContain("{...sigilHandlers(option.intention)}");
    // Nothing the plate draws can know what the record prefers: no band, no
    // resonance, no documented flag, no fit, no score reaches this module.
    expect(text).not.toMatch(/\bband\b|resonance|documented|\bfit\b|score|evidence/i);
    // The only per-sigil differences are the chosen one and the tab stop.
    expect(text).toContain("aria-checked={checked}");
    expect(text).toContain("aria-checked:border-glow");
  });

  it("is one stop in the tab order, as a radiogroup is", () => {
    const text = code(source());
    expect(text).toContain('role="radiogroup"');
    expect(text).toContain("tabIndex={option.intention === tabStop ? 0 : -1}");
    expect(text).toContain("const tabStop = selected ?? INTENTION_OPTIONS[0].intention;");
  });

  it("keeps every contract id the plate has ever carried", () => {
    const text = source();
    for (const id of [
      'data-testid="intention-constellation"',
      "data-testid={`intention-${option.intention}`}",
      'data-testid="world-cancel-interpretation"',
      'data-testid="world-inspect-attended"',
      "data-world-intention={option.intention}",
      "id={sigilControlId(option.intention)}",
    ]) {
      expect(text).toContain(id);
    }
  });

  it("never lets a click on the rail reach the arena behind it", () => {
    // Behind the plate a click is a background click (I-011) or a strand
    // picked (I-019): the rail's two controls are neither.
    const text = code(source());
    const stopped = text.match(/onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);/g) ?? [];
    expect(stopped).toHaveLength(2);
  });
});
