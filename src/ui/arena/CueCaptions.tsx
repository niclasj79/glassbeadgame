import { useEffect, useState } from "react";
import { castaliaConceptById } from "@/content/castalia/concepts";
import { facetById } from "@/content/castalia/facets";
import { toFacetId } from "@/content/castalia/schema";
import type { CaptionContext } from "@/runtime/captions";
import { cueBus } from "@/runtime/cues";
import { SAID_AGAIN, worldVoiceCaption } from "./worldVoice";

/**
 * THE LIVE REGION THE WORLD SPEAKS THROUGH.
 *
 * A player using a screen reader used to receive `presentation.message` and
 * nothing else — "Attention set. Choose an intention.", "Thread committed." —
 * which describes their own hand and never the answer. They could complete an
 * entire Game without being told once whether a relation was documented,
 * contested, or a reading the Game offers, while a sighted player was told in
 * the margin every single time. `Marginalia` even carried a comment claiming
 * this text already reached assistive technology through that region; it did
 * not, and this file is what makes the claim true.
 *
 * Deliberately `sr-only` rather than a second visible caption track: the margin
 * is the visible surface and the world is the primary interface, so this adds a
 * path rather than another panel. Which cues it carries, and the one correction
 * it applies to an interpretive relation, are decided in `worldVoice.ts`.
 */

const captionContext: CaptionContext = {
  conceptName: (id) => castaliaConceptById.get(id)?.name ?? "",
  facetName: (id) => facetById.get(toFacetId(id))?.name ?? "",
};

interface Spoken {
  /** Cue id. Keyed so the same sentence twice in a row is still a change. */
  readonly id: string;
  readonly text: string;
  readonly urgency: "polite" | "assertive";
  /**
   * For an answer that is said again when it is given again (`SAID_AGAIN`),
   * which arrival this is; null for every other caption.
   */
  readonly arrival: number | null;
}

/**
 * What the polite region says. An answer that is said again (`SAID_AGAIN`) is
 * written as a new element each time it arrives, so the region changes even
 * when its words do not; every other caption is written exactly as it always
 * was, as the region's text. Hook-free, so the difference can be asserted.
 */
export function PoliteWords({
  text,
  arrival,
}: {
  readonly text: string;
  readonly arrival: number | null;
}) {
  return arrival === null ? <>{text}</> : <span key={arrival}>{text}</span>;
}

export function CueCaptions() {
  const [spoken, setSpoken] = useState<Spoken | null>(null);

  useEffect(() => {
    let arrivals = 0;
    return cueBus.subscribe("caption", (cue) => {
      const caption = worldVoiceCaption(cue, captionContext);
      if (caption === null) return;
      arrivals += 1;
      setSpoken({
        id: cue.id,
        text: caption.text,
        urgency: caption.urgency,
        arrival: SAID_AGAIN.has(cue.type) ? arrivals : null,
      });
    });
  }, []);

  const polite = spoken?.urgency === "polite" ? spoken : null;
  const assertive = spoken?.urgency === "assertive" ? spoken : null;

  return (
    <section className="sr-only" aria-label="What the Game answered">
      <p role="status" aria-live="polite" aria-atomic="true">
        {polite === null ? "" : <PoliteWords text={polite.text} arrival={polite.arrival} />}
      </p>
      {assertive && (
        <p role="alert" aria-live="assertive" aria-atomic="true">
          {assertive.text}
        </p>
      )}
    </section>
  );
}
