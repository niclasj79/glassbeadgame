

# Glass Bead Game -- Full Teardown and Re-architecture Plan

## Current State Assessment

### Critical Bugs
1. **Concept generation is broken.** `ConceptGenerator.tsx` line 21: `const actualCount = Math.min(count, disciplines.length)` caps concepts to the number of disciplines (2-4), ignoring the requested 12-15. Selecting 2 disciplines = 2 concepts max. The entire arena feels empty.
2. **Fallback generator has the same bug** (line 11): `Math.min(count, disciplines.length)`. Both paths produce far fewer concepts than intended.

### Visual Teardown
- **Hero screen**: Clean gradient, good typography, but static. The floating particles are CSS `animate-pulse` dots -- not engaging. No motion, no pull to interact.
- **Discipline selection**: Generic card layout. Quick combos are plain text buttons. No visual preview of what you're choosing. No personality.
- **Arena (the core)**: 2D Canvas rendering a wireframe sphere with glass beads. Rendering is competent but underwhelming -- thin purple wireframe, small beads, hard to read labels. The sphere radius is hardcoded at 200px regardless of viewport. Connections between concepts are thin lines with no visual weight.
- **AI Interpretation**: Wall of randomly-selected purple prose. No actual AI -- just `Math.random()` picking from 3 canned paragraphs. No meaningful analysis of what the player actually did.
- **Bottom UI / Hesse Insights**: Currently disabled via feature flag. When off, the bottom bar is essentially empty space.

### Gameplay Loop Problems
1. **No goal.** Player picks disciplines, stares at beads, drags them around, timer runs out. There's no score, no challenge, no discovery mechanic, no feedback loop.
2. **No meaningful interaction.** Dragging a bead changes its x/y/z coordinates. Nothing happens. No synthesis, no reaction, no reward.
3. **No progression.** Every session is identical. No unlocks, no history, no growth.
4. **Timer is punitive, not motivating.** Countdown creates anxiety without purpose.
5. **"AI Interpretation" is fake.** Random text selection destroys trust. Players get flowery nonsense regardless of what they did.

### Technical Debt
- Massive SphericalArena.tsx (380 lines) with tangled concerns (audio, accessibility, touch, performance monitoring, memory management all in one component)
- Dozens of unused/redundant hook files (useOptimized*, usePerformant*, useEnhanced* variants)
- Supabase connection exists but the remix may not have the database tables
- External Supabase dependency should be migrated to Lovable Cloud

---

## Re-architecture Plan

### New Core Gameplay Loop: "Synthesis Discovery"

The player's goal becomes **finding resonances between concepts**. When two concepts from different disciplines are brought close together, the system generates a real AI-powered synthesis insight. The more surprising the combination, the higher the "resonance score."

```text
Pick Disciplines --> Arena with 12+ beads --> Drag beads together
       |                                            |
       v                                            v
  Quick or Manual                          Proximity triggers
  selection (2-4)                          AI synthesis check
       |                                            |
       v                                            v
  Animated intro                           Glowing connection +
  with discipline                          insight card appears
  preview                                         |
                                                   v
                                          Score grows, new
                                          connections unlock
                                                   |
                                                   v
                                          Session summary with
                                          real AI analysis of
                                          discoveries made
```

### Implementation Steps

#### Step 1: Fix concept generation (critical bug)
Remove the `Math.min(count, disciplines.length)` cap in both `ConceptGenerator.tsx` and `FallbackConceptGenerator.ts`. Allow multiple concepts per discipline (e.g., 4-5 per discipline for 3 disciplines = 12-15 concepts).

#### Step 2: Enable Lovable Cloud
Connect Lovable Cloud to replace the external Supabase project. Set up database tables (disciplines, concepts, game_sessions, etc.) and migrate the concept seed data. This enables AI features and reliable persistence.

#### Step 3: Redesign the arena visuals
- Increase sphere radius to be responsive (`Math.min(width, height) * 0.35`)
- Larger, more vibrant glass beads with discipline-colored glow halos
- Animated connection lines that pulse with energy when concepts are near each other
- Particle effects when beads are dragged (trailing sparkles)
- Background: animated nebula effect instead of static gradient
- Concept labels: larger font, always visible, with discipline icon

#### Step 4: Implement proximity-based synthesis mechanic
- When two concepts from different disciplines are dragged within a threshold distance, trigger a "resonance check"
- Visual: glowing bridge forms between them, particle burst, screen pulse
- Audio: harmonic chord plays based on the two disciplines
- A synthesis card slides up from the bottom showing the AI-generated connection
- Award "resonance points" based on the novelty of the pairing

#### Step 5: Real AI interpretation via Lovable Cloud
- Create an edge function that uses Lovable AI to generate synthesis insights when two concepts collide
- Replace the fake interpretation screen with a real session analysis that references actual player movements and discoveries
- Show a "discovery journal" of all synthesis moments found during the session

#### Step 6: Scoring and progression system
- Track total resonance points per session
- Show a running score in the arena header
- End-of-session ranking (e.g., "Novice Synthesizer" to "Grand Master")
- Store session history so players can see their discovery journal over time

#### Step 7: Improve the onboarding flow
- Hero: Add a subtle animated 3D sphere preview behind the title (canvas-based)
- Discipline selection: Show 2-3 sample concepts per discipline as preview chips
- Remove the timer or make it optional -- replace with a "discoveries remaining" mechanic
- Add a brief tutorial overlay on first arena entry ("Drag concepts together to discover connections")

#### Step 8: Polish and performance
- Remove all unused hook variants (useOptimized*, usePerformant*, useEnhanced*)
- Refactor SphericalArena into Arena (layout), ArenaCanvas (rendering), ArenaLogic (hook)
- Add haptic feedback on mobile for concept interactions
- Optimize canvas rendering with offscreen buffer for static elements

### Technical Notes

- **Lovable Cloud AI**: Use `supabase.functions.invoke('generate-synthesis')` with concept pairs as input. The edge function calls Lovable AI to produce a 2-3 sentence synthesis insight.
- **Scoring**: Pure client-side calculation based on: cross-discipline pairings (higher score), number of unique pairs discovered, and time efficiency.
- **Concept generation fix**: Change to `const conceptsPerDiscipline = Math.ceil(count / disciplines.length)` then loop through each discipline generating that many, capping total at `count`.

