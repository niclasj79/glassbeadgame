import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FACULTIES } from "@/content/castalia/faculties";
import { INTENTION_VOCABULARY } from "@/game/intentions";
import {
  THRESHOLD_ANSWERS,
  THRESHOLD_COPY,
  THRESHOLD_FACULTIES,
  THRESHOLD_VERBS,
} from "./thresholdCopy";

const source = (name: string): string =>
  readFileSync(join(process.cwd(), "src", "ui", "screens", name), "utf8");

describe("the threshold", () => {
  it("names the faculties exactly as the pack does", () => {
    // The screen introduces the four faculties and the arena draws from them.
    // If these ever diverge, a player is told the world contains something it
    // does not, which is the one kind of inaccuracy this project treats as a
    // defect rather than a nicety.
    expect(THRESHOLD_FACULTIES.map((f) => f.name)).toEqual(
      FACULTIES.map((f) => f.name)
    );
    expect(THRESHOLD_FACULTIES.map((f) => f.gloss)).toEqual(
      FACULTIES.map((f) => f.gloss)
    );
  });

  it("offers the same four verbs the plate will offer", () => {
    /*
     * The vocabulary was lifted out of `IntentionConstellation` precisely so a
     * DOM screen could introduce the verbs without importing an R3F component.
     * This test may not import it either — the first draft did, and it failed
     * in `detect-gpu` reading `navigator.userAgent`, which is the extraction
     * demonstrating its own point.
     *
     * So the plate's half is asserted against its source: it must compose from
     * the shared vocabulary rather than redeclare the glyphs. The glyphs
     * themselves are pinned here because they are the one thing a silent
     * mojibake regression would not otherwise catch, and this file has already
     * shipped the literal characters `&#215;` once.
     */
    expect(THRESHOLD_VERBS.map((v) => v.label)).toEqual([
      "Echo",
      "Passage",
      "Tension",
      "Ground",
    ]);
    expect(THRESHOLD_VERBS.map((v) => v.icon)).toEqual(["◌", "→", "≋", "□"]);
    expect(THRESHOLD_VERBS).toHaveLength(INTENTION_VOCABULARY.length);

    const plate = readFileSync(
      join(process.cwd(), "src", "scene", "IntentionConstellation.tsx"),
      "utf8"
    );
    expect(plate).toContain("INTENTION_VOCABULARY.map(");
    // Redeclaring any of them here would put the two surfaces back in a
    // position to disagree about what Echo means.
    for (const icon of ["◌", "→", "≋", "□"]) {
      expect(plate).not.toContain(`icon: "${icon}"`);
    }
  });

  it("states all three answers, including the two that assert nothing", () => {
    // A player who meets near-silence cold reads it as the game being broken
    // rather than as the game being careful. Naming all three here is what
    // makes the quiet ones legible when they arrive.
    expect(THRESHOLD_ANSWERS).toHaveLength(3);
    const text = THRESHOLD_ANSWERS.map((a) => `${a.kind} ${a.sentence}`).join(" ");
    expect(text).toMatch(/sources/i);
    expect(text).toMatch(/disagree/i);
    expect(text).toMatch(/cannot settle/i);
    expect(text).toMatch(/nothing credible/i);
  });

  it("says the point, which is the half a player cannot discover", () => {
    const point = THRESHOLD_COPY.point.join(" ");
    // The three claims that stop every silence reading as a failure.
    expect(point).toMatch(/no correct pairing/i);
    expect(point).toMatch(/nothing you do is scored/i);
    expect(point).toMatch(/nobody knows/i);
    // And the one that stops a contemplative game being played against a clock.
    expect(THRESHOLD_COPY.reassurance).toMatch(/nothing is timed/i);
  });

  it("promises nothing the game does not deliver", () => {
    // Every word a player reads here is a claim the build has to honour.
    // ADR-010: there is no score, so the threshold may not imply one, and it
    // may not offer to keep or share a Game until something does.
    const all = [
      THRESHOLD_COPY.welcome,
      THRESHOLD_COPY.verbsLead,
      THRESHOLD_COPY.answersLead,
      ...THRESHOLD_COPY.point,
      THRESHOLD_COPY.reassurance,
      ...THRESHOLD_ANSWERS.map((a) => a.sentence),
    ].join(" ");
    expect(all).not.toMatch(/\bpoints\b|\bscore(?!d\b)|\brank\b|\blevel\b|\bunlock/i);
    expect(all).not.toMatch(/\bsave\b|\bshare\b|\bexport\b/i);
    expect(all).not.toMatch(/\bwin\b|\blose\b|\bcorrect answer\b/i);
  });

  it("builds the draw after the press is answered, and behind a paint", () => {
    /*
     * THE LAW MOVED HERE FROM THE TITLE (scene/opening.test.ts).
     *
     * `startSession` builds the draw and mounts the arena synchronously, and
     * the measurements that produced this rule are recorded in
     * `scene/opening.ts`: every route through React, the motion library or a
     * CSS transition lost the frame, because a rendering update is exactly what
     * the build is standing on. The title no longer does this work, so the rule
     * now has to hold on the press that does.
     */
    const code = source("ThresholdScreen.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
    const flip = code.indexOf("setEntering(true)");
    const build = code.indexOf("startSession()");
    expect(flip).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(flip);
    // Deferred behind two frames, not called from the handler.
    expect(code).toContain("requestAnimationFrame");
    expect(code).not.toMatch(/onClick=\{\(\) => startSession\(\)\}/);
    // Answered on the way down, and arriving twice is a no-op.
    expect(code).toMatch(/onPointerDown=\{[\s\S]{0,200}enter\(\)/);
    expect(code).toContain("if (pressed.current) return;");
  });

  it("is a page and not a gate", () => {
    const code = source("ThresholdScreen.tsx");
    // The door is on the page from the first frame; there is nothing to skip
    // and nothing to acknowledge, so there must be no dismissal vocabulary and
    // no state remembering whether it has been seen.
    expect(code).not.toMatch(/hintsSeen|markHintSeen|dismiss|skip/i);
    // It scrolls, because it is longer than a short phone.
    expect(code).toContain("overflow-y-auto");
  });
});
