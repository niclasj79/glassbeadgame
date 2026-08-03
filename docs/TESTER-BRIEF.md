# Tester brief — Castalia vertical slice

**Build:** `6cd90e2` · 2026-08-03 · 24 concepts, 44 sourced relations
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
**Passage**, **Tension**, **Ground**. The claim under test is that they are
distinguishable from how the world *behaves* — sound, motion, material — without
reading the label.

You cannot administer this to yourself while you can see which sigil you pressed.
Either have someone else drive, or capture short clips and review them cold at
least a day later.

- [ ] Identify at least **three of four** from behaviour alone.
- [ ] Repeat in greyscale. Meaning must never be carried by colour.
- [ ] Repeat with reduced motion on.
- [ ] Repeat muted, reading only the captions.

Record which pair you confuse. Confusing two specific ones is a much more
actionable result than a score.

### Pass B — accessibility

- [ ] A complete session using **only the keyboard**. No mouse at all.
- [ ] A complete session with a screen reader running. The question is not
      whether it announces things — it does — but whether what you hear is *the
      same experience* or a summary of one.
- [ ] A complete session muted, captions only.
- [ ] A session at 200% browser zoom.
- [ ] A session on a real phone, on speakers, one-handed. Judge target sizes and
      whether the weave gesture is comfortable.

### Pass C — comfort over time

Comfort cannot be judged from a screenshot and this build has bounds written
into it that are not the same claim as *pleasant*.

- [ ] Fifteen unbroken minutes. Judge bloom and overall luminance at the end of
      it, not the start.
- [ ] Does any camera movement induce discomfort?
- [ ] Is **Tension** beautiful instability, or does it read as a wrong note?
- [ ] The binaural bed: turn it off and on (speaker icon, bottom right). Does the
      off switch feel findable by someone it is bothering?

### Pass D — offline and interruption

- [ ] Install as a PWA and play a session offline.
- [ ] Deploy an update mid-session and confirm nothing interrupts you.
- [ ] Play in a private window. Note what the interface tells you about whether
      the Game will be kept.

### Pass E — the record

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

**Cannot, because it does not exist yet:** anything about keeping, sharing, or
returning to a Game; anything about withdrawing a thread; anything about the sky
responding to the shape of the web.

## Known absences — do not seed these to a tester

These are the subject of open findings. A tester who spontaneously asks for one
is evidence; a tester who was told about it is not. Watch for questions 6, 7 and
8 in Part One to surface them unprompted.

- No way to undo or withdraw a committed thread.
- No way to save, export, or share a session. Closing the tab destroys it.
- No visible instruction in the arena at all. The only text naming the verb is
  in the screen-reader live region, so a sighted first-timer is told less than a
  screen-reader user.
- The world does not change as the web grows; the idle score is identical at
  minute one and minute fourteen.
- An unresolved thread and an Open Thread are drawn identically.

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
