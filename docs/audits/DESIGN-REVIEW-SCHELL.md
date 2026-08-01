# Design review — The Glass Bead Game read through Schell's lenses

**Source:** Jesse Schell, *The Art of Game Design: A Book of Lenses* (2nd ed.), 520 pp.
**Reviewed build:** `release/castalia-slice` @ `43951cc`, merged to `main` and deployed.
**Date:** 2026-08-02.
**Method:** the book's hundred lenses applied to the shipped slice, then each
finding checked against the source rather than against memory of it. File and
line references are to the reviewed tree.

Schell's method is not a checklist and this review does not treat it as one. A
lens is a question you hold up to a game; a good answer is often "we deliberately
do not do that, and here is why". Several lenses in this book would actively
damage this game if obeyed — those are collected at the end rather than silently
dropped, because the reason we reject them is itself a design position.

Findings are ordered by how much they would change the experience, not by how
easy they are.

---

## 1. The first thirty seconds teach nothing — and teach the sighted player least

**Lenses:** #48 Accessibility · #15 The Toy · #18 Flow · #53 Control

Schell's accessibility test is whether a player can picture their first few steps
without being told. His Lens of the Toy asks whether people want to touch the
thing before they know what it does. Flow asks first whether the game has a clear
goal, and second whether the player's goal is the one you intended.

What we actually ship:

- `TitleScreen.tsx` offers an epigraph and one door. No statement of what the
  Game is, no verb.
- The arena contains **no visible instruction of any kind**. Twelve beads, a
  "The Lens" button and a "Conclude" button (`ArenaHud.tsx:90–113`).
- The only text that names the verb — "Attention set. Choose an intention." —
  lives in an `sr-only` live region (`CueCaptions.tsx`), and only fires *after*
  the player has already guessed the first action.
- The margin column, which is the game's authored reading surface, stands empty
  for the entire opening (`Marginalia.tsx` renders nothing until a cue arrives).

So the screen-reader player is told what to do and the sighted player is not.
That inversion is unusual enough to be worth stating plainly: our accessibility
work overshot into being the *only* instruction channel.

The README explains the game beautifully. Players do not read the README.

**What to change.** Not a tutorial overlay — that would break the world. The
world already has a vocabulary for this. `idle.ts` kindles one bead every few
seconds, chosen by the clock. Let the first kindle be a *demonstration*: one
bead comes to attention unprompted, the four sigils bloom and fade, nothing is
committed. The player has now seen the verb performed in the world's own
language, before touching anything. Add one line of type in the empty margin —
the surface exists, it is styled, and it is doing nothing for the first sixty
seconds of every Game.

---

## 2. The game destroys everything it makes, and the machinery to keep it is already built and tested

**Lenses:** #5 Endogenous Value · #85 Expression · #65 The Story Machine · #74 The World

Schell's endogenous value asks what the player values and whether the game
reflects that back. His Story Machine lens ends on a hard practical point: a
story is only worth generating if there is someone the player can tell it to.

What we actually ship:

- `src/platform/indexeddb/` contains a complete, tested repository with a
  `PersistedSessionRecord` whose comment calls the event log "canonical".
- **It has zero consumers.** Every import from `src/platform` outside its own
  directory: none. Nothing in the running application saves a session.
- No share, no export, no clipboard write, no download anywhere in `src/`.
- The portrait plate ends on "Another Game draws different beads. Nothing carries
  over but what you learned to notice." (`PortraitPlate.tsx:293`) — which is a
  fine sentiment and also a literal description of data loss.

Fifteen minutes of composition, a portrait, an annotation, a thread register with
real citations — and closing the tab deletes all of it.

This is the highest-leverage finding in the review, because we are not proposing
to build anything. The repository is written. The event log is the canonical
record by design and replays deterministically. Wiring it is an afternoon.

**What to change.** Two controls on the portrait plate, both quiet:

- *Keep this Game* — writes the log, and offers past Games from the title.
- *Copy the reading* — plain text of the thread register, including the
  citations. This is the only route by which our sources ever leave the
  building, and it is the only thing a player can send to the friend who would
  care about the Bartók argument.

**The trap to avoid.** Kept Games must not become a collection. A list with a
count is a completion meter and ADR-010 rules it out. Keeping is not scoring:
no count, no badge, no "3 of 24 concepts seen". An archive is a shelf, not a
progress bar.

---

## 3. The central choice has a consequence the game immediately forgets

**Lenses:** #32 Meaningful Choices · #20 Judgment · #57 Feedback

Schell asks of every choice whether it has real impact on what happens next and
on how the game turns out, and — under the Lens of Judgment — whether the game
communicates its judgement, whether players think it fair, and whether they care
about it.

What the intention actually does:

| Reaches | Yes/No | Evidence |
|---|---|---|
| Which relation you get | **No** | `findRelation(a, b)` takes no intention (`resolveThreadOutcome.ts:210`) |
| The sentence you are told | Yes | `documentedStatement(intention, fit, …)` |
| The audio grammar and thread material | Yes | `planCues.ts`, `threadGrammar.ts` |
| Motif detection | Yes | `detectMotifs.ts:156, 201, 293` |
| The portrait | **Almost no** | one dimension counts tension edges (`buildPortrait.ts:253`) |
| `fit` / `stance` at the end | **No** | appears nowhere in portrait, annotation, or conclusion |

So the Game reads your reading — "your Echo reading is the one this relation is
documented around", "your reading runs across the record rather than along it" —
and then throws that judgement away. The single most emphasised decision in the
game is characterised in the moment and uncharacterised at the end.

**This is a real tension, not an oversight.** If `stance` fed the portrait,
"confirmed" would rank above "complicated" and CAV-006 collapses — outcomes would
start differing in reward. That is presumably why nobody wired it. But Schell's
observation about judgement is that players do not resent being judged, they
resent being judged *unfairly*; and we already judge, in prose, four to eight
times a session.

**What to change.** Add a portrait dimension that reads *how you read* without
ranking it. Not "you were right four times" but a characterisation computed from
the distribution of fits: *you read for opposition where the pack reads for
descent*; *you looked for grounds, and the record mostly offered echoes*. That is
a reading with no total, it is checkable against the register printed directly
above it, and it makes the four sigils matter after the moment they are pressed.

---

## 4. There is no interest curve — there is a flat line with a finale

**Lenses:** #61 The Interest Curve · #39 Time · #49 Visible Progress

Schell's shape: a hook, then rising interest punctuated by rest, then a finale
more interesting than anything before it, ideally repeating fractally at several
scales.

We have the finale. The conclusion performance is genuinely the best thing in the
build. We have the rest. We do not have the rise, and arguably not the hook.

- Attunement is the only staged event in a 12–18 minute arc, it is binary, and
  it is player-invoked (`attunementEligibility.ts`).
- The idle score — precession, one travelling light, kindling (`idle.ts`) — is
  identical at minute one and minute fourteen.
- Nothing else in the world responds to the web's *growth*, only to individual
  commits.

That flatness was partly earned honestly: the old world brightness was
`curatedDiscoveries / curatedAvailable`, a progress bar wearing a sky, and
removing it was correct. But removing a bad rise is not the same as designing a
good one.

**What to change.** Let the firmament answer the *composition*, using something
with no ordering built into it. `buildTopology` already knows the shape of the
web and `constellations.ts` already holds authored figures. As regions connect,
authored constellation lines become legible — a picture assembling, not a gauge
filling. It cannot be read as a percentage because there is no denominator on
screen, and it rises with the thing the game says it values.

---

## 5. The Open Thread is our best surprise and our most apologetic sentence

**Lenses:** #2 Surprise · #62 Inherent Interest · #4 Curiosity

Schell's surprise questions include whether the rules let players surprise
*themselves*. Ours do — an undocumented but structured pairing produces a
specific question nobody wrote for that pair.

Then we say this about it:

> Castalia has no documented relation for this pair. This is a question it can
> ask, not a finding it can assert. — `resolveThreadOutcome.ts:44`

Every word is true. The framing is a flinch. It opens with an absence, and the
game's most interesting outcome arrives dressed as a shortfall. The unresolved
statement does it again: "…and names no facet they share. The thread holds your
reading and nothing else."

Note also how little else varies: 12 beads drawn from 24 (`DEFAULT_SIZE = 12`),
44 fully authored relations. Between two Games, the draw is the only variable.
That makes the quality of the Open Thread's framing disproportionately important
— it is where most of the session's novelty actually lives.

**What to change.** One string, and the emotional shape of half the session
changes. Lead with the question, follow with the honest limit. The game is not
failing to find an answer; it is standing at the edge of what anyone has written
down. Say that without apologising for it. (Still honest — it *is* a question the
Game cannot settle. Honesty does not require a downcast tone.)

---

## 6. A missing verb the game's own thesis argues for

**Lenses:** #23 Emergence · #24 Action · #43 Elegance

Schell asks how many verbs the players have and how many objects each acts on.
Ours: attend, arm an intention, weave, cancel, inspect, Lens, attune, conclude.
Of these, exactly one changes the composition.

For a contemplative instrument, few verbs is right, and the Lens of Elegance
would praise the restraint. But there is one specific absence: **you cannot
unweave.** The eight event types are `session.started`, `pair.selected`,
`relation.hypothesized`, `thread.committed`, `motif.completed`,
`attunement.entered`, `attunement.exited`, `session.concluded`. Nothing retracts.

A game whose entire premise is *these are your readings* does not let you stop
standing behind one.

**What to change.** Not deletion — a retraction is an event, not an erasure.
`thread.retracted` appended to the log, replayed deterministically, the append-only
architecture entirely intact. And the presentation is already designed: a scribe
crosses out, a scribe does not scrape the page. The thread stays in the register,
struck through, with what it said still readable. That is the manuscript
behaviour the whole art direction is built on, and it would be the single most
*in-world* mechanic in the game.

---

## 7. The unresolved outcome makes the player feel corrected

**Lenses:** #57 Feedback · #58 Juiciness · #41 Punishment

The Lens of Feedback asks, at each moment, what the player needs to know, what
they want to know, and what you want them to *feel*. The Lens of Punishment asks
what you are punishing and whether it could be a reward instead.

A player draws a thread between two beads that share no facet. The Game answers
with a sentence explaining that nothing is there. The domain treats it as a real
thread — it is in the log, it is in the register. The presentation treats it as a
miss.

**What to change.** Let the thread hang, unlit, in the world. It is still the
player's reading; the Game simply has nothing to add to it. A visible strand that
no citation supports is a truer picture of what happened than a sentence and no
strand, and it costs nothing epistemically — an unlit thread claims nothing.

---

## 8. The nameless quality — a compliment with a warning attached

**Lenses:** #83 The Nameless Quality · #44 Character · #82 Inner Contradiction

Schell relays Christopher Alexander's fifteen properties of living structure.
This project has an unusual number of them by construction: levels of scale,
echoes, strong contrast, the void (darkness with material depth), inner calm,
not-separateness. Very few games earn those honestly. This one does.

What it may lack is Alexander's **roughness** — and Schell's own Lens of
Character makes the same point from the other side: the quirk that elegance would
sand off is often the thing players tell each other about. He asks whether there
is anything strange in your game that players talk about excitedly.

This build has been engineered to an extraordinary standard of internal
consistency. Every claim typed, every cue through one boundary, every colour
named for a material. That is a genuine achievement and a genuine risk: the most
consistent thing in the room is rarely the most memorable.

The strangest and best thing in the game is the contested Bartók/Fibonacci
relation — the one that cites Lendvai, cites Howat's 1983 criticism, and tells
the player to treat the attribution as disputed. It is the entire thesis of the
project in one card. It is currently reachable only if the draw happens to
produce both beads and the player happens to weave them.

**What to change.** Not "add quirks" — that would be a lie in this game's
particular grammar. Rather: make sure the pack's most contested, most alive
material is *reachable*, and give it presentation weight equal to its importance.
The card that says specialists disagree should be the card people describe when
they tell someone about this game.

---

## Lenses this game should deliberately fail

Schell's Lens #82 (Inner Contradiction) asks whether anything in the game defeats
the game's own purpose. Applying every lens uncritically would do exactly that.
Recorded so the rejection is a position and not an oversight:

- **#40 Reward / #49 Visible Progress (literal form).** Both push toward
  accumulating marks. ADR-010 exists because a number as the primary result makes
  the next Game an attempt to beat this one. Rejected — see finding 4 for the
  legitimate version of the same need.
- **#31 Challenge / #27 Skill / #36 Competition.** There is nothing here to be
  better at than someone else, and CAV-006 puts every outcome at equal weight.
  Rejected wholesale.
- **#86 Community / #84 Friendship / #87 Griefing.** No accounts, no backend, no
  multiplayer. Out of scope by architecture, not by omission.
- **#96 Profit.** Not a commercial product.
- **#33 Triangularity.** Safe play for a small reward versus risk for a big one
  requires rewards of different sizes. There are none.

Finding 2 is the one place where a rejected-looking lens is actually valid:
Schell's Story Machine is not asking for a leaderboard, it is asking whether the
player can tell anyone what happened. We currently cannot, and that is a real
loss, not a principled abstention.

---

## Director's recommendation

If only three are done, do these, in this order:

1. **Finding 2 — persist and export.** The code exists and is tested. Nothing
   else in this list returns as much for as little, and everything the game makes
   is currently discarded.
2. **Finding 1 — teach the verb in the world.** Cheap, in-world, and it fixes the
   most likely first-minute failure for a player who did not build this.
3. **Finding 3 — let the intention reach the ending.** The hardest of the three
   and the one that most changes what the game *is*: it makes the player's
   central decision matter after the moment it is made, without adding a score.

Findings 5 and 7 are close to free and could ride along with any of them.

---

*Nothing in this review establishes that the game is beautiful, comfortable,
well-paced, intellectually honest, or musically good. Those remain in
`DIRECTOR-SIGNOFF.md` §3, unticked, where only a person can tick them.*
