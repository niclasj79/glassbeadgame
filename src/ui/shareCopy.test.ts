import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FACULTIES } from "@/content/castalia/faculties";
import { TITLE_EPIGRAPH } from "./screens/titleEpigraph";

/**
 * WHAT THE GAME SAYS ABOUT ITSELF BEFORE IT IS OPENED.
 *
 * The share card is read by more people than the game is played by, and it
 * advertised a different product: "six disciplines", named as mathematics,
 * music, philosophy, physics, art and history. The Game has four faculties.
 * A link that describes something else is a promise the build cannot keep.
 */

const html = readFileSync(
  fileURLToPath(new URL("../../index.html", import.meta.url)),
  "utf8"
);

/** Every `content="…"` on a description-bearing meta tag. */
function descriptions(): readonly string[] {
  const found: string[] = [];
  const tags = html.match(/<meta[\s\S]*?\/>/g) ?? [];
  for (const tag of tags) {
    if (!/name="(description|twitter:description)"|property="og:description"/.test(tag)) {
      continue;
    }
    const content = /content="([\s\S]*?)"/.exec(tag);
    if (content) found.push(content[1]);
  }
  return found;
}

describe("the share copy", () => {
  it("describes the game in all three cards", () => {
    expect(descriptions()).toHaveLength(3);
  });

  it("names the four faculties this Game actually has", () => {
    for (const text of descriptions()) {
      for (const faculty of FACULTIES) {
        expect(text).toContain(faculty.name);
      }
    }
  });

  it("no longer advertises six disciplines that do not exist", () => {
    for (const text of descriptions()) {
      expect(text).not.toMatch(/six disciplines/i);
      for (const absent of [
        "mathematics",
        "philosophy",
        "physics",
        "history",
      ]) {
        expect(text.toLowerCase()).not.toContain(absent);
      }
    }
  });
});

describe("the title epigraph", () => {
  it("is set in typographic quotes, not in a code listing's", () => {
    expect(TITLE_EPIGRAPH.quotation.startsWith("“")).toBe(true);
    expect(TITLE_EPIGRAPH.quotation.endsWith("”")).toBe(true);
    expect(TITLE_EPIGRAPH.quotation).not.toContain('"');
    expect(TITLE_EPIGRAPH.quotation).not.toContain("'");
  });

  it("cites the fragment rather than dropping a bare name", () => {
    expect(TITLE_EPIGRAPH.attribution).toContain("Heraclitus");
    // A name alone is not a citation, and this is the first sentence in a game
    // whose entire content model is the difference between a claim and a
    // reading. The fragment number is the reference a reader can follow.
    expect(TITLE_EPIGRAPH.attribution).toMatch(/fragment\s+\d+/i);
    expect(TITLE_EPIGRAPH.attribution).not.toBe("Heraclitus");
  });
});
