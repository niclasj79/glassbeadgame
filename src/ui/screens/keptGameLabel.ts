import type { PersistedSessionRecord } from "@/platform/indexeddb/schema";

/**
 * HOW A KEPT GAME IS NAMED ON THE SHELF.
 *
 * By when it ended and by the first thing its annotation said — "You opened
 * with Fibonacci Sequence and Counterpoint, read as Echo" — because that is
 * the sentence that tells two Games apart. Never by a count: "7 threads" or
 * "3 of 24 concepts" would make the shelf a progress bar (ADR-010).
 */
export interface KeptGameLabel {
  readonly when: string;
  readonly said: string;
}

const FIRST_SENTENCE = /^[^.!?]*[.!?]/;

export function firstSentence(text: string | undefined): string {
  if (!text) return "";
  const trimmed = text.trim();
  const match = FIRST_SENTENCE.exec(trimmed);
  return (match ? match[0] : trimmed).trim();
}

export function formatKeptDate(
  endedAt: number,
  locale?: string
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(endedAt));
  } catch {
    return new Date(endedAt).toISOString().slice(0, 16).replace("T", " ");
  }
}

export function keptGameLabel(
  record: Pick<PersistedSessionRecord, "endedAt" | "annotation">,
  locale?: string
): KeptGameLabel {
  const said = firstSentence(record.annotation);
  return Object.freeze({
    when: formatKeptDate(record.endedAt, locale),
    said: said.length > 0 ? said : "A kept Game.",
  });
}
