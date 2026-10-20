# Proposal — Ashwood: a game for the learner

**Status:** Direction brief, recorded for later work and parked by the game
design director on 2026-10-20. It changes no canonical document and is not a
task packet. Before any build it needs an ADR, a specification and packets
under the protocol in `AGENTS.md`.
**Name:** Ashwood is Eschholz in English: the Castalian school where Joseph
Knecht is educated as a boy, before Waldzell and the Game itself.

---

## Summary

- The game as built stays what it is: **a game for the learned**. Castalia is
  for players who already know the ideas and come to hear how they rhyme.
- **Ashwood is a game for the learner**: a separate world in the same app,
  where a player comes to grasp a concept by exploring how it connects to
  other concepts, and how those connections combine.
- A concept is understood through its **edge bundle**: the set of typed
  relations around it, and what they say together. A single edge is a fact.
  A bundle is an explanation.
- The transformer's attention is the design metaphor: meaning comes from
  context, and one layer's output feeds the next. It is not evidence that the
  game teaches. That claim must stand on learning science and on tests with
  learners.

## The player and the promise

- **Who:** someone meeting a concept for the first time, or reviewing one that
  is familiar but not mastered.
- **What they gain:** they can explain the inner workings of a concept through
  how it relates to others. For example: *multiplication is like addition in
  that, for whole numbers above one, it makes the original bigger; it is like
  division in that it works with parts of the same size; it is unlike addition
  in that multiplying by one half makes it smaller.*
- **Quizzes are part of play.** A player confirms an edge by answering a
  multiple-choice question about it.

## The four relations

Each relation answers a question a learner actually asks. Each keeps the
direction of the Castalia intention it comes from, so the existing sound and
light grammar carries over.

| Castalia intention | Ashwood label | The learner's question | Direction |
|---|---|---|---|
| Ground | Builds on | What do I need first? | one way |
| Echo | Is like | What is it similar to, and in what way? | both ways |
| Tension | Is unlike | Where does the likeness break? | both ways |
| Passage | Is used in | Where does it show up and do work? | one way |

"Prerequisite" stays the data name for Builds on. The alternative label for
Passage is "Is a kind of", which suits a single-subject track but never
leaves the subject; "Is used in" is preferred because it carries transfer
between subjects.

## Design rules

1. **The "in that" is the knowledge.** Every edge carries its reason: *like A
   in that X*. A question asks in what way an edge holds, never only whether
   it holds, because a yes or no can be guessed.
2. **Every reason carries its scope.** "Multiplication makes bigger" is one of
   the best-documented misconceptions in mathematics education; it holds only
   for factors above one. An edge without its scope teaches the misconception.
3. **Is unlike marks where the scope breaks.** It is where a learner's model
   has to grow, as from multiplication as repeated addition to multiplication
   as scaling.
4. **Wrong options are real misconceptions.** A wrong answer then shows what
   the learner believes. The world answers it with a counterexample, not a
   penalty: there is still no failure state.
5. **A bundle grasps a concept.** A likeness, a boundary, a ground and a
   crossing into another subject, each checked from structure, so any fitting
   partners count.
6. **Grasped concepts become lenses.** A concept the player has grasped
   becomes a relation they can use on other pairs. Progress is a growing
   vocabulary, not a collection.
7. **Progression comes from the prerequisite graph.** The player is offered the
   concepts whose grounds they already hold, the outer fringe of knowledge
   space theory. Authors design the graph, not the path. The arc runs from
   depth inside one subject, to analogy between two, to abstraction across
   several.

## Content and verification

**Seed.** Marble's open skill taxonomy, measured on 2026-10-20:

| Measure | Count |
|---|---|
| Topics, ages about 4 to 12, US and UK curricula | 1,595 |
| Prerequisite edges, each with a one-line reason | 3,235 |
| Edges that cross subjects | 161 |
| Same-subject pairs sharing a prerequisite | 4,190 |
| Mathematics topics | 508 |

- **Builds on** comes directly from the prerequisite edges.
- **Is like and Is unlike** candidates come from siblings: concepts that rest
  on the same ground are the ones learners compare and confuse.
- **Is used in** is thin in the seed and must mostly be written fresh.
- **License:** the database is ODbL 1.0 and the text CC BY-SA 4.0. Any edge
  set published from it stays under ODbL, with attribution.

**Verification.** A language model may propose edges; a person who knows the
subject confirms, edits or rejects each one before it ships. Learners never
confirm truth: their answers measure difficulty and reveal misconceptions.
The proposal and review pipeline should be a standalone module, useful
beyond the game.

## What differs from Castalia's laws

- Edges in Ashwood are verified and some answers are correct. The player still
  composes the explanation; the game checks its structure and its reasons.
- Quizzes and tracked mastery are allowed. Points, streaks, ranks and timers
  are not.
- No failure state, as in Castalia. Nothing in Ashwood reaches the Free Game.

## Open questions

1. Who confirms the content: the director, or a subject teacher?
2. Is the first learner a child reading English, or an adult reviewing?
   Swedish would add a translation and a second review.
3. Does the Castalia Studies chapter named Eschholz keep its name?

## When resumed

1. Build the edge pipeline on about 25 topics around multiplication: candidates
   from siblings and cross-subject links, each written with its "in that" and
   scope, reviewed in a CSV sheet. Expected output: 60 to 100 verified edges.
2. Test on paper with two or three learners: ask them to explain
   multiplication before and after the bundle and its questions.
3. Only if their explanations improve: an ADR, an Ashwood specification and
   the first packets.

## References

### Learning theory

- Biggs, J. — SOLO taxonomy: understanding graded from one idea, to several,
  to related, to transferred.
  https://www.johnbiggs.com.au/academic/solo-taxonomy/
- Marton, F. (2014). *Necessary Conditions of Learning.* Variation theory:
  a concept is learned through contrast.
  https://doi.org/10.4324/9781315816876
- Gentner, D. (1983). Structure-mapping: a theoretical framework for analogy.
  *Cognitive Science.* Analogy teaches when relational structure aligns.
  https://doi.org/10.1207/s15516709cog0702_3
- Frayer, D. A., Frederick, W. C., & Klausmeier, H. J. (1969). *A schema for
  testing the level of concept mastery.* Wisconsin Research and Development
  Center for Cognitive Learning. The origin of the Frayer model: definition,
  characteristics, examples and non-examples. No stable link verified.
- Doignon, J.-P., & Falmagne, J.-C. — knowledge space theory and the outer
  fringe. https://en.wikipedia.org/wiki/Knowledge_space
- Novak, J. D., & Cañas, A. J. — the theory underlying concept maps: knowledge
  as labelled relations between concepts.
  https://cmap.ihmc.us/docs/theory-of-concept-maps
- Chi, M. T. H., et al. (1989). Self-explanations: how students study and use
  examples. *Cognitive Science.* Explaining is how understanding is built.
  https://doi.org/10.1207/s15516709cog1302_1
- Rittle-Johnson, B., & Star, J. R. (2007). Does comparing solution methods
  facilitate conceptual and procedural knowledge? *Journal of Educational
  Psychology.* Comparison as a teaching move.
  https://doi.org/10.1037/0022-0663.99.3.561
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning.
  *Psychological Science.* Questions as learning, not only measurement.
  https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Fischbein, E., Deri, M., Nello, M. S., & Marino, M. S. (1985). The role of
  implicit models in solving verbal problems in multiplication and division.
  *Journal for Research in Mathematics Education.* The source of the
  "multiplication makes bigger" misconception.
  https://doi.org/10.2307/748969
- Vaswani, A., et al. (2017). Attention is all you need. The transformer, used
  here only as a design metaphor. https://arxiv.org/abs/1706.03762

### Adjacent projects

- **Marble** — an open prerequisite map of primary school learning. One edge
  type; Ashwood adds three and the reasons.
  https://withmarble.com/curriculum/ and
  https://github.com/withmarbleapp/os-taxonomy
- **Math Academy** — adaptive mathematics on a knowledge graph of
  prerequisites, with spaced review. It teaches nodes; Ashwood trains the
  edges between them. https://www.mathacademy.com/how-our-ai-works
- **ALEKS** — adaptive learning built on knowledge space theory. Ashwood
  borrows its outer fringe for progression. https://www.aleks.com/
- **ConceptNet** — a typed common-sense graph whose relations include
  HasPrerequisite, SimilarTo, DistinctFrom and UsedFor: the same four ideas,
  without reasons, scope or review for teaching.
  https://github.com/commonsense/conceptnet5/wiki/Relations
- **Eedi and Diagnostic Questions** — multiple-choice questions whose wrong
  options are known misconceptions. Ashwood borrows the question form.
  https://www.eedi.com/ and https://diagnosticquestions.com/
- **Brilliant** — interactive, problem-first lessons. A precedent for
  teaching by doing; it teaches single concepts, not their relations.
  https://brilliant.org/
- **DragonBox** — games that teach algebra through play before naming it. A
  precedent for a learning world that is a game first.
  https://dragonbox.com/
- **Hesse, H. — The Glass Bead Game.** Castalia as an educational province,
  where the disciplines are mastered before the Game is played.
  https://en.wikipedia.org/wiki/The_Glass_Bead_Game
