import { useEffect, useState } from "react";
import { castaliaConceptById } from "@/content/castalia/concepts";
import { facetById } from "@/content/castalia/facets";
import { toFacetId } from "@/content/castalia/schema";
import type { CaptionContext } from "@/runtime/captions";
import { cueBus } from "@/runtime/cues";
import { worldVoiceCaption } from "./worldVoice";

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
}

export function CueCaptions() {
  const [spoken, setSpoken] = useState<Spoken | null>(null);

  useEffect(() => {
    return cueBus.subscribe("caption", (cue) => {
      const caption = worldVoiceCaption(cue, captionContext);
      if (caption === null) return;
      setSpoken({ id: cue.id, text: caption.text, urgency: caption.urgency });
    });
  }, []);

  const polite = spoken?.urgency === "polite" ? spoken : null;
  const assertive = spoken?.urgency === "assertive" ? spoken : null;

  return (
    <section className="sr-only" aria-label="What the Game answered">
      <p role="status" aria-live="polite" aria-atomic="true">
        {polite?.text ?? ""}
      </p>
      {assertive && (
        <p role="alert" aria-live="assertive" aria-atomic="true">
          {assertive.text}
        </p>
      )}
    </section>
  );
}
