# Glass Bead Game — Playtest Plan

## Status

Director review required.

This document is an operational companion to `MASTER-PLAN.md` and `VERTICAL-SLICE-SPEC.md`. It does not change their product contract. Proposed thresholds and unanswered director decisions below are not accepted requirements until reviewed and merged with an explicit answer.

## Purpose

Playtesting begins before the complete vertical slice, but each build must be judged only on the hypothesis it is capable of testing. The current prototype can test atmosphere and preservation qualities; it cannot validate the redesigned interpretation-and-composition thesis.

The program separates five questions:

1. **Preservation:** what is already distinctive and must survive?
2. **Interaction:** can a player Attend → Hypothesize → Weave → Commit without coaching?
3. **Meaning:** do documented relations, Open Threads, and silence feel intellectually honest?
4. **Audiovisual language:** can players perceive relation and topology through form and sound?
5. **Whole experience:** does the exact web produce a personal fifteen-minute arc and conclusion?

## Evidence rules

- Observe behavior before asking for opinions.
- Do not explain a control until the participant is genuinely blocked; record the intervention.
- Record exact build/commit, device, input mode, audio mode, viewport, and seed.
- Separate a defect, comprehension failure, taste response, accessibility barrier, and missing feature.
- Do not treat one enthusiastic quote as validation or one confused participant as a mandate.
- Automated tests establish correctness and repeatability; they do not establish comfort, meaning, pacing, or artistic quality.
- Content assertions are not accepted because a participant finds them plausible.
- A failed milestone playtest creates design evidence, not a player failure.

## Standard session record

```text
Build/commit:
Milestone hypothesis:
Participant code:
Prior familiarity with art/music/knowledge games:
Device, viewport, input, audio, accessibility settings:
Seed and route:
Time to first meaningful action:
Interventions given:
Observed action sequence:
Confusions and recoveries:
Participant language used for relations:
Threads the participant could explain afterward:
Comfort or accessibility issues:
Strongest moment:
Weakest moment:
Defects:
Design findings:
Follow-up decision or task proposal:
```

## Milestone matrix

| Build | Primary test | Must not be claimed yet |
| --- | --- | --- |
| Current legacy prototype | atmosphere, readability, setup, comfort, preservation inventory | redesigned core-loop validation |
| M2 gate | interaction comprehension and input equivalence with placeholder presentation | intellectual outcome quality or final audiovisual grammar |
| M3 gate | documented/Open Thread honesty and explanatory ownership | polished relation legibility or final pacing |
| M4 gate | audiovisual distinction among Echo, Passage, Tension, and Ground | topology-driven session differentiation |
| M5 gate | semantic motifs and materially different web response | complete conclusion and portrait |
| M6 gate | full internal session arc, Attunement, performed conclusion, portrait | offline/public accessibility certification |
| M7 gate | reload, offline, accessibility, mobile/device resilience | release content and final polish |
| M8 gate | external release-candidate experience | untested full-version promises |

## Baseline playtest — current prototype

### Hypotheses

- **B-01:** The title, setup, world, glass beads, typography, and score already establish a distinctive contemplative identity.
- **B-02:** Players can begin a session and manipulate the current arena without a technical failure.
- **B-03:** The hidden-pair, score, counter, and Illuminate framing feels more like answer-seeking than interpretation; this is diagnostic evidence, not behavior to optimize.
- **B-04:** Lens, Codex, Daily Draw, Consecration, and conclusion contain preservation-worthy ideas even where their present mechanics will change.

### Observation questions

- What does the participant believe the goal is before and after the arena introduction?
- Which visual, spatial, musical, or ritual elements do they spontaneously mention?
- Do they experiment or hunt systematically for authored pairs?
- Which counters, prompts, or rewards dominate attention?
- Where do text, bloom, motion, audio, camera, or input become uncomfortable?
- Which existing feature would they miss if removed?

### Proposed success criteria

- A preservation inventory names concrete elements to keep, adapt, and remove.
- Every technical or comfort barrier is reproducible or recorded with device context.
- Findings are not used to approve the old hidden-answer loop.

## M2 playtest — new interaction loop

### Hypotheses

- **M2-01:** A player can discover attention, select a candidate, declare an intention, weave, commit, and cancel without a text-heavy tutorial.
- **M2-02:** Resonance preview suggests possibility without communicating a hidden correct endpoint.
- **M2-03:** Echo, Passage, Tension, and Ground are understandable enough to support a choice before polished audiovisual grammar exists.
- **M2-04:** Mouse, touch, and keyboard paths express the same decisions and consequences, even when their gestures are not physically identical.
- **M2-05:** Cancellation is safe, reversible, and free of durable side effects.
- **M2-06:** The sequence feels like one contemplative act rather than a chain of menus.

### Observation questions

- What first causes the participant to attend to a bead?
- What do they think candidate resonance means?
- Do they assume the strongest resonance is the correct answer?
- Can they explain the four intentions in their own words?
- At what point do they expect commitment to occur?
- Can they cancel at attention, pair, intention, and weave stages and recover their prior context?
- Does the keyboard path feel authored or merely tolerated?
- Which step feels redundant, interruptive, or unclear?

### Proposed success criteria

- At least four of five first-time participants complete one full loop with no more than one facilitator intervention.
- At least four of five correctly state that resonance is possibility, not correctness.
- Every participant can cancel and resume without a reload or unintended durable event.
- Every critical action is completed by mouse, touch, and keyboard in dedicated test passes.
- No participant is blocked by color-only meaning or dexterity.
- Median time to the first committed interpretation is at most ninety seconds in the overture build.

## M3 playtest — documented relations and Open Threads

### Hypotheses

- **M3-01:** Players distinguish evidence-backed revelation from their own interpretation and from an unresolved Open Thread.
- **M3-02:** An Open Thread feels like a specific worthwhile question, not consolation text or fabricated significance.
- **M3-03:** Weak or silent outcomes preserve trust better than generic praise.
- **M3-04:** Players can explain why they made at least half of their committed threads.

### Observation questions

- Which statements does the participant believe the game is asserting as fact?
- Can they identify the source/evidence boundary without being quizzed on terminology?
- Does an Open Thread invite curiosity or feel like a failed answer?
- When the game responds with fragility or silence, does the participant understand what remains unresolved?
- Does the result refine or erase the participant's declared interpretation?

### Proposed success criteria

- At least four of five participants correctly distinguish documented, open, and weak/unresolved outcomes.
- No tested Open Thread is described as generic praise or invented fact by more than one participant.
- All documented assertions shown in the build have reviewed sources and evidence classes.
- At least half of each participant's threads can be explained by that participant after the session.

## M4 playtest — semantic audiovisual grammar

### Hypotheses

- **M4-01:** Echo, Passage, Tension, and Ground are distinguishable without relying only on label or color.
- **M4-02:** Relation choice changes preview immediately and the committed response remains recognizable.
- **M4-03:** Tension is unstable and expressive without becoming punishing or unpleasant.
- **M4-04:** Attention creates perceptible visual and musical space.

### Observation questions

- Which category does the participant infer from an unlabeled example, and what cues support the inference?
- Can they distinguish the categories with reduced motion, reduced bloom, or audio captions?
- Which cues contradict one another across scene, camera, audio, and UI?
- Does repeated feedback remain legible without becoming exhausting?
- Does controlled dissonance communicate Tension or merely sound wrong?

### Proposed success criteria

- Each participant identifies at least three of the four categories from unlabeled multimodal examples.
- No category depends on color alone; every category has a non-color visual pattern and a textual/audio-equivalent description.
- Human review accepts comfort, pacing, hierarchy, and cross-modal coherence for at least one representative pair per category.

## M5 playtest — motifs and topology response

### Hypotheses

- **M5-01:** Deliberately different webs produce recognizably different world and musical behavior.
- **M5-02:** Dialectic, Canon, and Bridge feel like semantic discoveries rather than graph achievements.
- **M5-03:** Motif completion changes the composition without exposing optimization counters.

### Observation questions

- What changed because of the meaning of the web rather than its size?
- Can the participant describe why a motif formed?
- Do players start optimizing a visible rule instead of interpreting concepts?
- Are topology responses cumulative, legible, and bounded in performance cost?

### Proposed success criteria

- Participants distinguish the two prescribed golden-path variants without seeing their labels.
- At least four of five participants can explain a completed motif using concepts and relations, not points or degree counts.
- Human review finds that the motif changes scene and music materially without obscuring ongoing play.

## M6 playtest — full internal vertical slice

### Hypotheses

- **M6-01:** The session sustains a contemplative 12–18 minute arc without time pressure.
- **M6-02:** Attunement feels invited by the composition rather than unlocked by a meter.
- **M6-03:** The conclusion audibly and visibly belongs to the exact session.
- **M6-04:** The portrait and Annotation are interpretable, stable under replay, and not disguised scores.
- **M6-05:** Players want another Game for expressive reasons.

### Observation questions

- When does the participant feel the web has become a composition?
- Why do they enter or ignore Attunement?
- Which moments in the conclusion do they recognize from their own actions?
- Does the portrait sound specific to the web or generically flattering?
- What would they deliberately do differently in another Game?

### Proposed success criteria

- At least four of five participants describe the final web as their interpretation.
- At least four of five recognize two or more session-specific moments in the conclusion.
- The participant can explain at least half of the threads and at least three relation categories.
- Replay produces the same domain result and materially equivalent performance structure.
- No participant reports timer pressure, failure punishment, or a need to grind score.

## M7/M8 playtests — resilience and release

### Hypotheses

- The golden path works offline after initial load, survives reload, and restores the correct event-derived session.
- Reduced motion, reduced bloom, keyboard, captions/text equivalents, touch, and quality fallbacks preserve critical meaning.
- Target desktop and mobile devices meet accepted comfort and performance budgets.
- External participants understand the experience without developer context.

### Proposed success criteria

- All supported input/accessibility/device matrices have a recorded pass or an accepted issue.
- No P0/P1 defect remains.
- External testing evaluates the Master Plan's experience criteria with no facilitator explanation of the thesis.
- Release content, sources, copy, audio, and audiovisual comfort receive explicit human acceptance.

## Director decision queue

Complete the `Director answer` field and change the status only through reviewed repository changes.

### P-001 — Earliest redesigned-loop playtest

- **Question:** Should supervised player testing begin at the complete M2 gate, or earlier with a partial attention/resonance prototype?
- **Recommended default:** Run a three-person formative test as soon as attention + resonance + cancellation is visible, then a five-person gate test at M2 completion.
- **Director answer:** _Pending._
- **Status:** Director decision required before the first production M2 interaction prototype is scheduled.

### P-002 — Participant cohorts

- **Question:** Who must be represented in formative and gate tests?
- **Recommended default:** Mix knowledge-game newcomers, art/music-curious players, one accessibility-focused participant, and no more than one person already familiar with the project.
- **Director answer:** _Pending._
- **Status:** Director decision required before recruiting.

### P-003 — Numerical thresholds

- **Question:** Are the proposed four-of-five comprehension thresholds and ninety-second first-recognition target accepted?
- **Recommended default:** Accept them as internal warning thresholds, not statistical proof or release guarantees.
- **Director answer:** _Pending._
- **Status:** Director decision required before M2 gate evaluation.

### P-004 — Recording and privacy

- **Question:** May sessions record screen, pointer path, audio, or participant voice, and what consent/retention policy applies?
- **Recommended default:** Written consent; screen and voice optional; use participant codes; store only what is required for the finding; define deletion date before recording.
- **Director answer:** _Pending._
- **Status:** Director decision required before any recording.

### P-005 — Target devices for internal gates

- **Question:** Which concrete desktop, mobile, audio, and assistive setups are mandatory at M2, M4, and M7?
- **Recommended default:** Desktop mouse/keyboard, modern iOS or Android touch, headphones and muted/captioned passes, reduced motion, and one low-tier GPU profile from M2 onward.
- **Director answer:** _Pending._
- **Status:** Director decision required before claiming input or audiovisual coverage.

### P-006 — Session-length target

- **Question:** Is 12–18 minutes a hard internal M6 target, or may the first complete prototype run shorter while pacing is tuned?
- **Recommended default:** Permit 8–12 minutes for the first M6 formative build; require the specified 12–18 minute arc before M6 acceptance.
- **Director answer:** _Pending._
- **Status:** Director decision required before M6 test planning.

### P-007 — External testing boundary

- **Question:** At what milestone may people outside the trusted internal group receive a build?
- **Recommended default:** Small invitation-only external test after M6; broader test only after M7 persistence/accessibility/device gates.
- **Director answer:** _Pending._
- **Status:** Director decision required before external distribution.

### P-008 — Human acceptance authority

- **Question:** Who besides the game design director may accept content truth, accessibility, audiovisual comfort, and artistic-quality gates?
- **Recommended default:** Director retains product acceptance; named subject-matter, accessibility, audio, and visual reviewers provide required evidence in their domains.
- **Director answer:** _Pending._
- **Status:** Director decision required before M3/M4 gate sign-off.
