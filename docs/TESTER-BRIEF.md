# Tester brief — Castalia vertical slice

**Build:** the focus view, `codex/M2-012-focus-view` · 2026-09-30 · 24 concepts, 44 sourced relations
**Runs at:** `npm run dev` → http://localhost:8080
**Session length:** 12–18 minutes. Budget 30 with the questions afterwards.

This is the operational companion to `PLAYTEST-PLAN.md`, which holds the
evidence rules and the session record template and still governs. That document
describes the *programme*; this one describes *this build*. Where they disagree
about what the game currently does, this one is right and the other is stale.

---

# PART ONE — hand this part to the tester

Everything below the line in this section is safe to read before playing.
**Do not read Part Two until the first session is over.** It names things that
cannot be observed once they have been pointed at.

---

## Before you start

- **Headphones.** Not optional. A large part of what is being judged is sound,
  and the bed includes a binaural component that stereo speakers destroy.
- Desktop browser, window at least 1280×800. A phone pass comes later.
- Quiet room. This is a slow game and it does not compete for attention.
- Have something to write with. You will be asked what you remember, and
  reconstructing it afterwards from the screen is not the same evidence.

## What you are about to do

You will be shown a dark space with some glass beads in it, each carrying an
idea from mathematics, music, image, or the physical world. You look for
relationships between them and say what kind of relationship you think each one
is. The game answers — sometimes with a documented relation and its sources,
sometimes with a question it says it cannot settle, sometimes with almost
nothing. When you have said what you wanted to say, you conclude, and the
session reads itself back to you.

**That is deliberately all you are being told.** Whether the game teaches you
the rest is one of the things being tested. If you get stuck, stay stuck for a
while before asking — the length of time you were stuck is data.

There is no score, no timer, no rank, and nothing to unlock. You cannot lose and
you cannot fall behind.

## Play

Play one full session. Conclude when you feel you have said something, not when
you run out of beads.

## Write these down straight afterwards, before discussing anything

1. **How long before you did something that felt deliberate?** Roughly. Not your
   first click — your first click that you *meant*.
2. **What did you think you were supposed to do, in the first minute?** Even if
   you were wrong. Especially if you were wrong.
3. **Name three threads you made and why.** In your own words. If you cannot
   reconstruct three, say how many you can.
4. **Did anything the game said strike you as untrue, overclaimed, or too
   confident?** Quote it if you can.
5. **When did you first feel the world respond to you** rather than just react
   to a click?
6. **Was there a moment you wanted to undo something?** What?
7. **Anything you wanted to keep, save, or send to someone?** Did you look for a
   way?
8. **Where did it drag?** Give a minute range if you can.
9. **The conclusion:** did it feel like *your* session, or like a summary that
   could have followed any session? Name anything in it you recognised.
10. **Would you play again — and if so, to do what?** "To do better" and "to say
    something different" are very different answers and the difference matters.
11. **Anything uncomfortable?** Eye strain, a sound that grated, motion that
    unsettled, a moment that felt too bright or too loud.
12. **When the world went dim around a bead, what did you think it wanted from
    you?** Say what you thought at the time, not what you worked out later.

## Please do not

- Do not read the README, the source, or any other document in this repository
  before playing. The README explains the game; that is exactly what is being
  tested.
- Do not let anyone explain a control to you until you are genuinely blocked. If
  someone does, note what was said and at what point.
- Do not report the absence of a feature as a bug. Report that you wanted it.
  That is more useful and it is what is actually being measured.

---

# PART TWO — after the first session

## Directed passes

Each of these is a separate sitting. They are listed in the order that wastes
the least time.

### Pass A — the blind intention pass

The game has four ways of saying what kind of relationship you see: **Echo**,
**Passage**, **Tension**, **Ground**. They appear only once two beads are held
together, on the thread between them, and resting on one lets you see and hear
that reading before you choose it. The claim under test is that they are
distinguishable from how the world *behaves* — sound, motion, material — without
reading the label.

You cannot administer this to yourself while you can see which sigil you pressed.
Either have someone else drive, or capture short clips and review them cold at
least a day later.

- [ ] Identify at least **three of four** from behaviour alone.
- [ ] Identify them again from the **preview alone** — resting on each sigil
      without weaving. Is the preview the same reading as the woven thread, or
      a different promise?
- [ ] Repeat in greyscale. Meaning must never be carried by colour.
- [ ] Repeat with reduced motion on.
- [ ] Repeat muted, reading only the captions.

Record which pair you confuse. Confusing two specific ones is a much more
actionable result than a score.

### Pass B — accessibility

- [ ] A complete session using **only the keyboard**. No mouse at all. The
      route: Tab into the beads, arrows to move, Enter to choose a bead; move
      to a second bead (it is sighted as you reach it) and Enter to hold the
      pair; arrows choose a reading; hold Enter to weave; Escape steps back one
      stage at a time.
- [ ] A complete session with a screen reader running. The question is not
      whether it announces things — it does — but whether what you hear is *the
      same experience* or a summary of one.
- [ ] A complete session muted, captions only.
- [ ] A session at 200% browser zoom.
- [ ] A session on a real phone, on speakers, one-handed. After choosing a bead,
      one finger sweeps the lens and two fingers turn the world. Judge target
      sizes, whether the lens stays visible beside the thumb, and whether
      holding a sigil to weave is comfortable.

### Pass C — comfort over time

Comfort cannot be judged from a screenshot and this build has bounds written
into it that are not the same claim as *pleasant*.

- [ ] Fifteen unbroken minutes. Judge bloom and overall luminance at the end of
      it, not the start.
- [ ] Does any camera movement induce discomfort? Choosing a bead brings it
      close in the lower left; holding a pair turns to frame both.
- [ ] The fog: after five minutes of choosing beads, is the dimming and
      softening restful, or tiring to keep refocusing?
- [ ] Is **Tension** beautiful instability, or does it read as a wrong note?
- [ ] The binaural bed: turn it off and on (speaker icon, bottom right). Does the
      off switch feel findable by someone it is bothering?

### Pass D — the focus view

The arena was redesigned around finding a second bead: choose one bead, and the
world dims and softens while your pointer becomes a lens; the right column holds
the chosen bead's card above an empty place for a second one. These checks ask
whether that reads as intended. Do them in one sitting, on the desktop first.

- [ ] Before choosing anything, rest the pointer on a bead for a second. Does the
      card that opens feel like help or like an interruption?
- [ ] Choose a bead. Does the dim-and-soften read as *focus*, or as loading, a
      fault, or a modal dialog?
- [ ] Sweep the lens across the arena. Can you find a second bead by looking
      through it, or do you hunt for the cursor?
- [ ] The empty place under the first card: did you understand it before the
      line "Find a second bead." appeared? That line waits about three seconds.
      Was that too soon, too late, or never needed?
- [ ] When a second bead's card opens, the facets both beads carry are lit.
      Did that read as *a clue about structure* or as *the game telling you the
      right answer*? Did the unlit ones feel like a verdict?
- [ ] "These two share no facet Castalia knows." Did that stop you from weaving
      the pair? Should it have?
- [ ] After a weave, the thread's card stays until you do something else. Did it
      ever close before you had finished reading? Did you know how to set it
      aside?
- [ ] Click a thread you wove earlier. The view returns to that pair and its
      reading. Did you find this without being told? Escape leaves it.
- [ ] Repeat the first four with reduced motion on (no camera travel, dim-only
      fog) and on the low quality tier.

### Pass E — offline and interruption

- [ ] Install as a PWA and play a session offline.
- [ ] Deploy an update mid-session and confirm nothing interrupts you.
- [ ] Play in a private window. Note what the interface tells you about whether
      the Game will be kept.

### Pass F — the record

This one needs no play. It needs a desk and a couple of hours.

- [ ] Read `src/content/castalia/relations.ts` end to end — all 44. For each ask
      one question only: **is the evidence class right?** `established`,
      `attested`, `contested`, `interpretive`.
- [ ] Read `src/content/castalia/sources.ts` — 38 citations.
- [ ] Decide whether any relation should be **cut**. Silence is always available
      and is preferable to a claim you would not defend.

---

# PART THREE — director only

Do not include this in a copy handed to anyone else.

## What this build can and cannot answer

**Can:** interaction legibility without coaching · whether Castalia reads as its
own world rather than generic space · whether the four intentions are
distinguishable · whether the outcome prose reads as honest · pacing across a
full arc · whether the conclusion feels session-specific · comfort · every
accessibility route.

**Can, since the focus view (M2-012), and has never been judged by a person:**
whether choosing the pair before the reading makes the second bead feel like a
decision rather than a destination · whether the fog and lens read as focus ·
whether the two-card column with lit shared facets guides without telling ·
whether hearing a reading before choosing it changes which reading is chosen ·
whether reopening a woven thread is discovered unprompted · whether the thread
card staying until the next act feels like reading time or like clutter.

**Cannot, because it does not exist yet:** anything about withdrawing a thread;
anything about a Game having a subject; anything about Castalia asking first;
anything about Studies or goals (M9-001 is not in this build); anything about
glyphs for facets (the cards name facets in text only).

**Can, since the 2026-09-05 pass, and has never been judged by a person:**
whether the shelf at the title reads as a shelf and not a collection; whether
the sky's figures assembling as faculties connect reads as a picture rather than
a gauge; whether an unlit strand reads as "the Game has nothing to add" rather
than as a fault; whether a motif arriving after its outcome, and waiting under
it, gives the middle game a beat.

## Known absences — do not seed these to a tester

These are the subject of open findings. A tester who spontaneously asks for one
is evidence; a tester who was told about it is not. Watch for questions 6, 7 and
8 in Part One to surface them unprompted.

- No way to undo or withdraw a committed thread.
- Little instruction in the arena itself. The threshold page names the pieces
  and the point before the arena opens; inside it, the only visible text naming
  a step is the column's "Find a second bead." after a pause and the caption
  that names the four readings when a pair is held.
- The room does not change stage as the web grows. The sky's figures assemble
  as faculties connect, and the bed swells with reach; the armillary, the
  light and the kindling are the same at minute one and minute fourteen.
- Every Game opens on the same four beads.

Addressed on earlier branches, and therefore now things to *watch* rather than
to listen for: a Game is kept on this device when it concludes and can be
re-read from the shelf at the title, and its reading can be copied as text with
the citations intact; an unresolved thread hangs unlit and is drawn differently
from an Open Thread; the Open Thread leads with its question rather than with
an absence; the intention reaches the portrait as a seventh reading.

Addressed by the focus view, and equally things to watch: the pair is chosen
before the reading; a woven thread can be reopened to re-read its card; a card
opens on its own when the pointer rests on a bead.

## The one thing that has never been observed

**Nobody has ever heard the conclusion performance.** It compiles
deterministically from the event log and its structure is asserted in tests, and
no human has listened to a session play itself back. Weave enough to reach
Attunement, conclude, and *listen to the whole thing without reading the page*.
It is the single largest untested claim in the slice.

## Recording

Use the standard session record in `PLAYTEST-PLAN.md`. Add the build hash above.
Findings feed `DIRECTOR-SIGNOFF.md`, which is the acceptance document — and no
item in it may be ticked by anyone who did not personally do the thing.
