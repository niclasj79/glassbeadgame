# Glass Bead Game — Studies Specification

## Status

Binding for the Studies spike (`docs/tasks/M9-001-studies-spike.md`) once
merged; ADR-015 records the decision it rests on. This document covers the
spike only. Later Study families, retracting a thread, chapter titles, the
Daily Study and Open Thread quests remain proposals in
`docs/proposals/GAMEPLAY-MODES.md` and are not part of this contract.

Where this document and `VERTICAL-SLICE-SPEC.md` speak about the same surface,
this one governs Studies and that one governs the Free Game. Neither changes
the other.

## 1. Definition

A **Study** is an authored problem posed over a fixed set of beads and solved
by weaving. It uses the Free Game's verbs (Attend, sight and lock a second
bead, choose a reading, weave), its content pack, its outcome rules and its
cards, unchanged. What it adds is a brief, a rule that checks the brief, and an
answer.

The title offers two doors: **Free Game** (the session the slice already
defines) and **Studies**. Nothing in a Study reaches the Free Game.

## 2. The honesty rules

These four rules bind every Study, present and future. A Study that breaks one
is a defect, whatever else it does well.

- **R1 — Public information only.** Whether a Study can be solved, and whether
  it has been, depends only on concept identity, faculty and facets — the
  things a player can read from the beads. It never depends on documented
  relations, evidence classes, sources or Open Thread prompts. The evaluator
  is typed over the structural lookup alone, so the rule holds by
  construction and not by care.
- **R2 — Marks of form, never marks of truth.** A result and its marks are
  computed from the structure of the woven threads: how many, which faculties,
  which facets they carry. No result may depend on whether a thread met a
  documented relation, an Open Thread or nothing. Outcome cards appear exactly
  as in the Free Game and weigh nothing.
- **R3 — No timer, no failure, unlimited attempts, nothing lost.** A Study has
  two states the player can see: *solved* and *not yet*. Weaving beyond the
  brief's count is allowed and is reported, never punished.
- **R4 — The Free Game is untouched.** No goal, budget, mark, brief or Study
  copy appears in a Free Game session. ADR-010 continues to hold there without
  amendment.

## 3. Vocabulary

- **Carrying thread** — a committed thread whose two beads share at least one
  facet. The shared facets are what the thread *carries*. A thread whose beads
  share no facet is woven and shown as in the Free Game, but carries nothing.
- **Brief** — the goal in the Game's own words, shown in the margin for the
  whole Study.
- **Count** — the number of threads the brief names ("in three threads"). It
  describes the answer's shape; the session's total thread count is not
  limited.
- **Answer** — either a line of threads that meets the brief, or **silence**:
  the declaration that the brief cannot be met with these beads.
- **The Magister's answer** — the authored answer, shown after the Study is
  solved and never before.
- **Marks** — at most three words about the form of the player's answer (§6).
- **Chapter** — a named group of Studies. The spike has three: Eschholz,
  Waldzell, Vicus Lusorum.

## 4. Goals

Three goal kinds exist in the spike. Each is evaluated over the woven graph of
the current session, considering carrying threads only.

### 4.1 Passage — "From A to B in N threads"

Solved when a path of carrying threads joins A to B using at most N threads.
Threads outside that path are permitted. Authoring rule: N equals the length
of the shortest carrying way between A and B within the Study's beads, so no
shorter answer exists.

### 4.2 Canon — "Carry F through K faculties"

Solved when the threads that carry facet F (both beads carry F) contain a
connected group whose beads span at least K distinct faculties. The expected
count is K − 1 threads.

### 4.3 Carry — "Carry F into X"

Solved when some thread carrying facet F has one bead in faculty X.

## 5. Silence

Every Study, whatever its goal, offers the same control: **It cannot be
done.** Declaring it is an answer, not a surrender.

- If no answer exists within the Study's beads, the declaration solves the
  Study, and the plate states why in structural terms ("No Matter bead here
  carries Proportion"; "No bead here carries a facet of both Just Intonation
  and Polyrhythm; the shortest way needs three").
- If an answer exists, the Game says *Not yet — it can be done with these
  beads*, and nothing more. It does not reveal the answer.

Whether a Study is a silence Study is never shown before it is solved, and
the goal's wording is the same for solvable and unsolvable briefs. The
authored answer is proven at build time (§9).

## 6. Result and marks

A Study is either **not yet** or **solved**. There is no third state, no
partial credit and no total.

When solved, the plate shows: the player's answer as a line of beads and the
facets each thread carried; the Magister's answer beside it; the count the
brief asked for and the number of threads the session used, stated plainly
("solved in five; the brief asked for three"); and up to three marks:

- **Economical** — the session used exactly the brief's count of threads;
- **Wide** — the beads of the answer span all four faculties;
- **Varied** — consecutive threads of the answer carry no facet in common.

Marks are words, not points. Nothing counts them, stores them or sums them.

## 7. Presentation

- **The brief** is the first note in the margin, pinned for the whole Study
  and re-openable at any time. Outcome cards arrive as in the Free Game.
- **Facets are visible** through the focus view (I-018), in both modes: the
  two cards light the facets both beads carry, and the thread card names what
  a committed thread carries. A Study adds nothing to this; it relies on it.
  Glyphs are a later art pass; text is sufficient for the spike.
- **The silence control** exists in the world margin and in the accessible
  DOM mirror, on every Study.
- **Solved** is one coordinated moment through the cue boundary (ADR-009):
  scene, audio, caption and the plate together. **Not yet** is a caption and
  a margin line; it never interrupts.
- **The plate** offers four ways on: *Keep weaving* (the plate is set aside
  and the session goes on — weaving beyond the brief is allowed, R3 — and the
  brief's note offers *See the answer* to read the plate again), *Again*
  (restart this Study), *Next Study*, *Back to the Studies*. Escape is *Keep
  weaving*.
- **No counters.** No "3 of 12", no percentage, no progress bar, no chapter
  completion. The Studies list shows briefs, not results.
- In Study mode the arena shows no Conclude, no Lens and no Attunement
  invitation. The threshold page is not shown; Studies open from the title.
- Every control has mouse, touch and keyboard paths, and every cue a textual
  equivalent, as the slice requires.

## 8. Determinism and replay

A Study session is an ordinary session: `session.started` with seed
`study:<studyId>`, the Study's beads as `conceptIds` in authored order, the
Castalia world and the pinned pack version, and session id
`session:<packVersion>:study:<studyId>`. No event type or payload is added
(ADR-013). The Study's status is a pure function of the session state and the
Study definition; replaying the log reproduces it exactly. Declaring silence
is ephemeral and is not logged. Restarting a Study starts a new session with
the same seed.

## 9. Content rules

Studies are authored data in the Castalia pack, validated at build:

- eight beads per Study, listed in pack order;
- a solvable Study's authored answer is a genuine answer of the brief's exact
  count, and no shorter answer exists within the beads;
- a silence Study has no answer within the beads; a passage silence has an
  answer within count + 1, so the player can find the longer way and learn
  what the count means;
- a passage Study has at most four answers within the beads;
- every distractor shares at least one facet with some bead of the Study;
- at least three faculties are present;
- no two Studies use the same set of beads;
- briefs are rendered from the goal, never hand-written per Study, so a
  thirteenth Study costs one definition.

## 10. Persistence

None in the spike. A Study session is never kept on the shelf and never
concludes; leaving discards it. What a player learned is what carries over.

## 11. Exclusions

Retracting a thread, hints, remembering solved Studies, chapter titles or any
progression, the Daily Study, Open Thread quests, Bridge and Dialectic
families, facet glyph art, and a solution that "sounds like its logic" are all
out of scope. Each may be proposed after the spike has been played.
