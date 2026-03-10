

# Plan: Tetris Effect-Inspired Sensory Overhaul

## Findings from Testing

1. **Beads are nearly invisible.** The sphere radius is responsive (~275px on 1336-wide viewport), but the beads are tiny dots -- `baseSize = 18 + concept.energy * 12 * scale`. At depth scales of 0.4-0.6, these are 12-15px dots scattered across a large dark canvas. They're barely visible.
2. **1-minute timer is too short.** `useSessionTimer` gives 60 seconds for unauthenticated users. That's not enough to find a single resonance, let alone experience flow. No authentication is implemented, so every session is 60 seconds.
3. **No continuous audio.** The "background soundscape" creates 1-2 sine oscillators at barely audible volume (0.01-0.05 gain). There's no beat, no rhythm, no evolving soundtrack. The discipline sounds are single 600ms sine tones. This is not a soundtrack -- it's isolated beeps.
4. **No visual feedback on every interaction.** Dragging a bead produces no particle trail. Rotating the sphere has no visual response. There's no screen pulse, no reactive background. The background nebula moves at `Date.now() * 0.0001` -- imperceptibly slow.
5. **Goal remains unclear.** The tutorial says "drag concepts together" but there's no visual hint about which beads to combine, no proximity indicator until they're very close, no breadcrumbs toward discovery.
6. **The concept count bug may still have issues** -- the toast said "14 concepts across 0 disciplines" (the discipline count display is wrong).

## Design Philosophy: Tetris Effect Flow

Tetris Effect achieves flow through: (1) a persistent, evolving soundtrack that reacts to player actions, (2) every input producing satisfying visual + audio feedback, (3) the background environment responding to gameplay state, (4) building intensity as the player progresses.

We'll apply these principles:

## Implementation Steps

### Step A: Reactive Audio Soundtrack System
**Replace** the current bare-oscillator audio with a layered, rhythmic soundtrack:

- **Base drone layer**: Low-frequency pad per discipline that evolves with rotation (already partially exists, but make it richer with detuned oscillator pairs and filters)
- **Rhythmic pulse**: A subtle rhythmic element (filtered noise bursts or sine plucks) that provides a heartbeat. Tempo increases as more discoveries are made.
- **Interaction sounds**: 
  - Bead hover: soft bell chime (high-frequency sine with fast decay)
  - Bead grab: ascending tone
  - Bead release/drop: resonant plop (low sine with pitch bend)
  - Sphere rotation: whoosh (filtered noise, panning with rotation direction)
  - Proximity approaching: rising harmonic tension (detuned interval narrowing)
  - Synthesis discovered: full chord burst + shimmering arpeggio
- **Dynamic mix**: Volume/filter/reverb changes based on `score.totalResonance` -- the soundtrack literally evolves as you play better

**Files**: Rewrite `useAudioEngine.ts` with new methods: `playHoverSound()`, `playGrabSound()`, `playDropSound()`, `playRotationWhooosh()`, `playProximityTension()`, `playSynthesisChord()`, `startRhythmicPulse()`, `updateSoundtrackIntensity()`. Update `AudioEngine.tsx` to expose these. Wire into `CanvasRenderer.tsx` and `SphericalArena.tsx`.

### Step B: Visual Feedback on Every Action
Add reactive visuals throughout:

- **Bead drag trail**: When dragging, render 8-10 fading afterimages behind the bead's path (stored in a trail buffer). Use discipline color.
- **Sphere rotation particles**: When rotating, spawn small particles that stream in the rotation direction, creating a "wind" effect.
- **Background reactivity**: The nebula clouds should pulse in sync with the rhythmic audio. When a discovery is made, the background briefly brightens and shifts hue.
- **Proximity glow zone**: When two cross-discipline beads are within 2x threshold, render a glowing "attraction field" between them -- a soft light cone pulling them together visually.
- **Discovery burst**: Full-screen radial particle burst when synthesis is triggered. Screen flash. The sphere wireframe briefly brightens.
- **Bead idle animation**: Beads should gently float/bob with a small sine offset, not sit perfectly still. This creates life.

**Files**: `ConceptRenderer.ts` (trails, idle bob), `BackgroundRenderer.ts` (reactive nebula, screen flash), `ConnectionRenderer.ts` (attraction fields), new particle system in `CanvasRenderer.tsx`.

### Step C: Increase Timer to 5 Minutes + Remove Pressure
Change `useSessionTimer` default to 300 seconds (5 minutes). Add a visual timer that's unobtrusive -- just a thin progress bar at the very top, not a countdown clock. Remove "Ending soon" warning. The session should feel spacious.

**Files**: `useSessionTimer.ts`, `SessionHeader.tsx`.

### Step D: Make Beads Larger and More Visible
- Increase base bead size from `18 + energy * 12` to `28 + energy * 16`
- Increase halo radius multiplier from 2.4 to 3.0
- Add a constant gentle pulse to all beads (not just energy-dependent)

**Files**: `ConceptRenderer.ts`.

### Step E: Visual Hint System for Proximity
- When no discoveries have been made yet, render subtle animated arrows or dotted guide lines between the 2-3 closest cross-discipline pairs, hinting "try bringing these together"
- After the first discovery, show a counter: "3 of 12 possible connections found" in the header
- Color-code the score display to glow brighter as you approach the next rank

**Files**: `CanvasRenderer.tsx` (hint arrows), `ScoreDisplay.tsx` / `SessionHeader.tsx` (connection counter).

### Step F: Screen-Wide Reactive Effects Layer
Add a new renderer that draws full-screen effects on top of everything:
- **Beat pulse**: Subtle vignette that pulses with the rhythm
- **Discovery flash**: Brief white/gold radial flash centered on the midpoint of the two concepts
- **Score milestone**: When rank changes, brief particle fireworks from the score display
- **Ambient particle field**: Tiny floating motes that drift with sphere rotation, creating parallax depth

**Files**: New `EffectsRenderer.ts`, integrated into `CanvasRenderer.tsx` render loop.

## Implementation Order
1. Step C (timer fix -- trivial, instant improvement)
2. Step D (bigger beads -- trivial, instant improvement)
3. Step A (audio overhaul -- core of the Tetris Effect feel)
4. Step B + F (visual feedback -- the other half of flow)
5. Step E (hints -- completes the goal clarity)

