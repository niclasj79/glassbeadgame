import type { Annotation } from "@/domain/annotation";
import type { Portrait } from "@/domain/portrait";
import type { KeepStatus } from "@/runtime/persistence";
import type { ThreadReading } from "./threadRegister";

/**
 * THE READING, AS TEXT A PERSON CAN SEND.
 *
 * The only route by which the Game's sources ever leave the building. The
 * portrait plate prints the register with its citations; this is the same
 * register, in the same order, with the same epistemic labels, as plain text —
 * so the friend who would care about the Bartók argument can be sent the
 * argument and the three references, not a screenshot of them.
 *
 * Nothing is added. No score, no total, no line the plate does not show.
 */
export interface ReadingTextInput {
  readonly annotation: Annotation;
  readonly threads: readonly ThreadReading[];
  readonly portrait: Portrait;
  /** Game-clock milliseconds when the Game concluded, if known. */
  readonly endedAt?: number | null;
}

const RULE = "—".repeat(3);

function block(lines: readonly (string | null | undefined)[]): string {
  return lines.filter((line): line is string => Boolean(line && line.length > 0)).join("\n");
}

export function readingAsText(input: ReadingTextInput): string {
  const { annotation, threads, portrait, endedAt } = input;
  const when =
    endedAt === undefined || endedAt === null
      ? null
      : new Date(endedAt).toISOString().slice(0, 10);

  const head = block([
    "THE GLASS BEAD GAME · a Game in Castalia",
    when,
    "",
    ...annotation.sentences,
  ]);

  const register =
    threads.length === 0
      ? "No thread was woven."
      : threads
          .map((entry, index) =>
            block([
              `${index + 1}. ${entry.reading}`,
              `   ${entry.standing}`,
              `   ${entry.title}`,
              `   ${entry.body}`,
              entry.aside ? `   — ${entry.aside}` : null,
              entry.sourceLine ? `   ${entry.sourceLine}:` : null,
              ...entry.citations.map(
                (citation) =>
                  `     ${citation.citation}${citation.locator ? ` — ${citation.locator}` : ""}`
              ),
            ])
          )
          .join("\n\n");

  const readings = portrait.dimensions
    .map((dimension) =>
      block([
        `${dimension.label} — ${dimension.phrase}`,
        dimension.evidence.length > 0 ? `   ${dimension.evidence.join(" · ")}` : null,
      ])
    )
    .join("\n");

  const count = threads.length === 1 ? "One thread" : `${threads.length} threads`;

  return [
    head,
    RULE,
    "THE THREADS, IN THE ORDER THEY WERE WOVEN",
    register,
    RULE,
    `${count} · ${portrait.dimensions.length} readings, no total`,
    readings,
  ].join("\n\n");
}

/**
 * What the plate says about whether this Game was kept. Null while there is
 * nothing to say. Never a count, never a prompt to keep more.
 */
export function keptStatusLine(status: KeepStatus, viewingKept: boolean): string | null {
  if (viewingKept) return "Kept on this device.";
  switch (status) {
    case "keeping":
      return "Keeping this Game on this device…";
    case "kept":
      return "Kept on this device. You will find it on the shelf at the title.";
    case "kept-for-now":
      return "Kept for this visit only: this browser is not keeping anything between visits. Copy the reading if you want it.";
    case "unavailable":
      return "This Game could not be kept. Copy the reading if you want it.";
    case "unkept":
      return null;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
