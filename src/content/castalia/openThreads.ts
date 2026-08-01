import type { RelationIntention } from "@/domain/events";
import { toFacetId, type OpenThreadPrompt } from "./schema";

/**
 * OPEN THREAD PROMPTS
 *
 * An Open Thread is what a pairing becomes when the player's reading is
 * genuinely interpretable and the Game has nothing documented to answer with.
 * It is not a consolation prize and it is not filler: the prompt is assembled
 * from a facet the two beads actually share plus the intention the player
 * declared, so the question is specific to *their* reading.
 *
 * Rules these templates obey, enforced by `validate.ts`:
 *
 *  - a prompt is a question, ends in '?', and names both beads via `{a}`/`{b}`;
 *  - a facet-specific prompt may use `{facet}`; a fallback may not, because a
 *    fallback has to render when no shared facet was found;
 *  - the question must be one a person could actually go and pursue — it asks
 *    for a document, a measurement, a mechanism, or a distinction;
 *  - it never asserts influence, never says a connection exists, and never
 *    praises the player for finding it.
 *
 * Facets carried by only one bead (orientation, imitation, entrainment,
 * optical-mixture, compromise, irreversibility) can never be *shared*, so they
 * get no prompt.
 *
 * TWO RULES THAT ONLY SHOW UP WHEN A TEMPLATE IS INSTANTIATED.
 *
 * A template that reads well in the abstract can be nonsense once `{a}`, `{b}`
 * and `{facet}` hold real names, so `castalia.test.ts` fills every one of these
 * against every pair that can actually reach it. Two shapes failed that way and
 * must not come back:
 *
 *  - **A bead is not a proposition.** "Which claim in {b} would fail if {a} were
 *    false" is fine for a theorem and meaningless for a phenomenon or an
 *    instrument: Coupled Pendulums cannot be false. Ask what is taken from what.
 *  - **A facet is not an agent.** A facet is a property both beads carry, never
 *    a channel between them, so nothing may "carry information from {a} into
 *    {b}" or "bring {a} and {b} back together". And `{facet}` renders as the
 *    facet's *display* name — `periodicity` prints "Return" — so a slot that
 *    presumes a bare abstract noun produces "the period of Return".
 */
const prompt = (
  id: string,
  intention: RelationIntention,
  question: string,
  facet?: string
): OpenThreadPrompt =>
  Object.freeze(
    facet === undefined
      ? { id, intention, question }
      : { id, intention, facet: toFacetId(facet), question }
  );

export const CASTALIA_OPEN_THREADS: readonly OpenThreadPrompt[] = Object.freeze([
  // ── Fallbacks: one per intention, usable when no facet is shared ─────────
  prompt(
    "thread.fallback.echo",
    "echo",
    "What structure would have to be exhibited in both {a} and {b} for the resemblance to hold, and what observation would show it is only a resemblance?"
  ),
  prompt(
    "thread.fallback.passage",
    "passage",
    "By what route could {a} have reached {b} — whose hands, which text, what date — and does any record of that route survive?"
  ),
  prompt(
    "thread.fallback.tension",
    "tension",
    "Where exactly do {a} and {b} disagree: about the same question, or about which question is worth asking?"
  ),
  prompt(
    "thread.fallback.ground",
    "ground",
    "What exactly does {b} take from {a}, and what in it would stop working if that support were withdrawn?"
  ),

  // ── threshold ───────────────────────────────────────────────────────────
  prompt(
    "thread.threshold.echo",
    "echo",
    "Both {a} and {b} turn on {facet}. Do the two thresholds respond to the same quantity, or only to the same word?",
    "threshold"
  ),
  prompt(
    "thread.threshold.tension",
    "tension",
    "{a} and {b} both cross a boundary. Does {facet} change behaviour in kind for both, or does one of them only change in degree?",
    "threshold"
  ),
  prompt(
    "thread.threshold.ground",
    "ground",
    "If {facet} is what {b} rests on, what sets the value at which it tips, and does {a} fix that value or merely describe it?",
    "threshold"
  ),
  prompt(
    "thread.threshold.passage",
    "passage",
    "Could an account of {facet} have travelled from {a} to {b}, and is there a text or an instrument that would record the crossing?",
    "threshold"
  ),

  // ── discreteness ────────────────────────────────────────────────────────
  prompt(
    "thread.discreteness.echo",
    "echo",
    "{a} and {b} both count in steps. Are the steps of {facet} indivisible for the same reason in each, or for different ones?",
    "discreteness"
  ),
  prompt(
    "thread.discreteness.tension",
    "tension",
    "Does {facet} force the same steps on {a} and {b}, or does one accept them by convention while the other has no choice?",
    "discreteness"
  ),
  prompt(
    "thread.discreteness.ground",
    "ground",
    "What forbids anything between the steps of {facet} in {a}, and does {b} inherit that prohibition or impose one of its own?",
    "discreteness"
  ),

  // ── superposition ───────────────────────────────────────────────────────
  prompt(
    "thread.superposition.echo",
    "echo",
    "Both {a} and {b} let parts occupy one place. Do they add linearly under {facet}, and can you name a case where they do not?",
    "superposition"
  ),
  prompt(
    "thread.superposition.ground",
    "ground",
    "If {facet} lets the parts of {b} simply add, which property of {a} guarantees it, and where does that guarantee stop holding?",
    "superposition"
  ),
  prompt(
    "thread.superposition.tension",
    "tension",
    "{a} and {b} both rely on {facet}, but is the combining rule addition in both, or is it governed from outside in one of them?",
    "superposition"
  ),

  // ── decomposition ───────────────────────────────────────────────────────
  prompt(
    "thread.decomposition.passage",
    "passage",
    "{a} and {b} both take a whole apart along {facet}. Does one decomposition reassemble exactly, and could the method have carried across?",
    "decomposition"
  ),
  prompt(
    "thread.decomposition.ground",
    "ground",
    "Does {facet} give {b} components that are unique, and would {a} still hold if that decomposition were not the only one available?",
    "decomposition"
  ),
  prompt(
    "thread.decomposition.echo",
    "echo",
    "Both {a} and {b} resolve into parts. Are the parts independent under {facet} in each of them, or independent in only one?",
    "decomposition"
  ),

  // ── periodicity ─────────────────────────────────────────────────────────
  prompt(
    "thread.periodicity.echo",
    "echo",
    "{a} and {b} both show {facet}. Is the period fixed by measurement in one of them and by decision in the other?",
    "periodicity"
  ),
  prompt(
    "thread.periodicity.tension",
    "tension",
    "{a} and {b} both show {facet}, each on its own count. What would have to be true for the two periods to coincide, and what resists it?",
    "periodicity"
  ),
  prompt(
    "thread.periodicity.passage",
    "passage",
    "Could the treatment of {facet} in {a} have reached {b}, and would a shared period count as evidence or as coincidence?",
    "periodicity"
  ),

  // ── proportion ──────────────────────────────────────────────────────────
  prompt(
    "thread.proportion.echo",
    "echo",
    "{a} and {b} both organise by ratio. Is {facet} the same ratio in each, or the same use of ratio applied to different quantities?",
    "proportion"
  ),
  prompt(
    "thread.proportion.ground",
    "ground",
    "If {facet} supports {b}, which ratio is doing the work, and is that ratio measured in {a} or simply assumed by it?",
    "proportion"
  ),
  prompt(
    "thread.proportion.passage",
    "passage",
    "Is there a document showing the proportions of {a} being used to make {b}, or only the same numbers turning up in both?",
    "proportion"
  ),

  // ── viewpoint ───────────────────────────────────────────────────────────
  prompt(
    "thread.viewpoint.tension",
    "tension",
    "{a} and {b} each require a place to stand. Does {facet} put those places in conflict, or could one observer hold both at once?",
    "viewpoint"
  ),
  prompt(
    "thread.viewpoint.ground",
    "ground",
    "What fixes the correct standpoint for {b}, and does {a} supply that constraint or only happen to share {facet} with it?",
    "viewpoint"
  ),
  prompt(
    "thread.viewpoint.echo",
    "echo",
    "Both {a} and {b} resolve from one position. Is {facet} the same position, or the same kind of dependence on having one?",
    "viewpoint"
  ),

  // ── interference ────────────────────────────────────────────────────────
  prompt(
    "thread.interference.tension",
    "tension",
    "{a} and {b} both cross two patterns. Does {facet} produce genuine cancellation in each, or only coincidence and near-miss?",
    "interference"
  ),
  prompt(
    "thread.interference.echo",
    "echo",
    "Are the crossings in {a} and {b} governed by the same arithmetic of {facet}, and what measurement would settle whether they are?",
    "interference"
  ),

  // ── invariance ──────────────────────────────────────────────────────────
  prompt(
    "thread.invariance.ground",
    "ground",
    "Which quantity is actually preserved in {a}, and does {b} preserve a quantity at all or only a likeness under {facet}?",
    "invariance"
  ),
  prompt(
    "thread.invariance.echo",
    "echo",
    "{a} and {b} both keep something through change. Is {facet} preserved exactly in each, or exactly in one and approximately in the other?",
    "invariance"
  ),

  // ── continuity ──────────────────────────────────────────────────────────
  prompt(
    "thread.continuity.tension",
    "tension",
    "{a} and {b} both depend on unbroken variation. Does {facet} break anywhere in one of them, and what happens at the break?",
    "continuity"
  ),
  prompt(
    "thread.continuity.ground",
    "ground",
    "If {facet} is unbroken in {a}, does that survive in {b}, or is it interrupted by how {b} has to be made or performed?",
    "continuity"
  ),

  // ── projection ──────────────────────────────────────────────────────────
  prompt(
    "thread.projection.passage",
    "passage",
    "{facet} is where a passage from {a} to {b} would show. What is lost in that crossing, and could any later step recover it?",
    "projection"
  ),
  prompt(
    "thread.projection.ground",
    "ground",
    "Which freedom does {facet} give up in {a}, and does {b} depend on that loss or find a way to work around it?",
    "projection"
  ),

  // ── recursion ───────────────────────────────────────────────────────────
  prompt(
    "thread.recursion.echo",
    "echo",
    "{a} and {b} both reapply a rule to its own result. Is {facet} the same rule at every scale, or a different rule at each?",
    "recursion"
  ),
  prompt(
    "thread.recursion.ground",
    "ground",
    "How many times can {facet} be applied in {b} before the construction fails, and does {a} set that limit or leave it open?",
    "recursion"
  ),

  // ── incommensurability ──────────────────────────────────────────────────
  // `{facet}` prints "No Common Measure" here, which cannot stand as the subject
  // of a verb — "Does No Common Measure make them…" is not English. Both prompts
  // therefore name the facet and then refer back to it.
  prompt(
    "thread.incommensurability.tension",
    "tension",
    "{a} and {b} have {facet} between them. Does that make them merely slow to align, or unable to align at all?",
    "incommensurability"
  ),
  prompt(
    "thread.incommensurability.echo",
    "echo",
    "{a} and {b} both carry {facet}. Is it the same failure to divide in each, and what unit would have to exist for them to line up?",
    "incommensurability"
  ),

  // ── tiling ──────────────────────────────────────────────────────────────
  prompt(
    "thread.tiling.echo",
    "echo",
    "{a} and {b} both fill their space. Does {facet} repeat exactly in each, or does one of them only appear to repeat?",
    "tiling"
  ),
  prompt(
    "thread.tiling.ground",
    "ground",
    "Which symmetries does {facet} permit in {b}, and does {a} explain the ones it forbids or merely describe them?",
    "tiling"
  ),

  // ── remaining shared facets ─────────────────────────────────────────────
  prompt(
    "thread.self-reference.echo",
    "echo",
    "{a} and {b} both fold back on themselves. Does {facet} produce a contradiction in each, or an obstruction in one and a curiosity in the other?",
    "self-reference"
  ),
  prompt(
    "thread.quantisation.tension",
    "tension",
    "Is {facet} imposed on {a} by a boundary and on {b} by a decision, and what evidence would distinguish the two cases?",
    "quantisation"
  ),
  // `thread.irreversibility.ground` was removed with the facet it was keyed to.
  // Conservation of Energy no longer claims Irreversibility — the First Law is
  // time-reversal symmetric — so Entropy is the only bead that carries it, the
  // facet can never be shared, and the prompt could never have fired again.
]);
