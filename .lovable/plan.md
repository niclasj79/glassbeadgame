

# Plan: 3D Interaction Improvements, Discovery Log, Color Overhaul, and WebXR Feasibility

## 1. Better 3D Depth Conveyance

**Problem:** Mouse gives 2 axes; the sphere has 3. Users can't tell if a bead is in front or behind, or control depth when dragging.

**Solution -- Visual depth cues + interaction hints:**

- **Size-based depth scaling:** Already present via `project3DTo2D` perspective, but the range is too narrow (scale 0.25-1.0 with distance=400). Increase the perspective effect so back-beads are noticeably smaller and front-beads larger.
- **Opacity + blur by depth:** Beads further back (higher z after rotation) get lower opacity and a subtle desaturation. This creates atmospheric perspective.
- **Shadow/ground plane hint:** Render a faint elliptical "shadow" below each bead projected onto the sphere equator, giving vertical depth cues.
- **Rotation momentum/inertia:** After releasing a rotation drag, the sphere continues spinning with friction. This lets users "spin" the sphere to find beads on the back. Currently rotation stops immediately on mouseUp.
- **Scroll wheel = Z-axis rotation:** Add `onWheel` to tilt the sphere on the X-axis, giving a third input dimension.
- **Depth indicator on drag:** When dragging a bead, show a small "depth ring" or vertical line indicating where the bead sits on the Z-axis relative to the sphere center.
- **Hover tooltip:** On hover (not click), show concept name + discipline badge. Currently requires click.

**Files to edit:**
- `ConceptRenderer.ts` -- depth-based opacity/size scaling, shadow rendering
- `CanvasRenderer.tsx` -- add `onWheel` handler
- `useSimplifiedPointerHandlers.ts` -- rotation inertia
- `useInteractions.ts` / `useEventHandlers.ts` -- wheel event wiring
- `SphereRenderer.ts` -- optional equator shadow plane

---

## 2. Discovery Log (Persistent Message Panel)

**Problem:** Synthesis cards auto-dismiss after 6 seconds. Insights are lost.

**Solution:** Add a collapsible "Discovery Journal" panel on the left side of the arena.

- Slide-out panel triggered by a journal icon button (fixed position, left side)
- Shows all `SynthesisDiscovery[]` from `useProximitySynthesis` in reverse chronological order
- Each entry: concept pair names, discipline badges, insight text, resonance score, timestamp
- Unread indicator (badge count) on the toggle button when new discoveries arrive while panel is closed
- Panel overlays the canvas with `backdrop-blur` and partial transparency
- Remove the auto-dismiss timer from `SynthesisCard`; instead, the card stays until manually dismissed or a new one arrives (replacing it)

**New files:**
- `src/components/game/arena/DiscoveryLog.tsx` -- the panel component

**Files to edit:**
- `SphericalArena.tsx` -- pass discoveries array, wire up log panel
- `useProximitySynthesis.ts` -- remove or lengthen auto-dismiss timer
- `SynthesisCard.tsx` -- keep as the "latest toast" but also feed into log

---

## 3. WebXR Feasibility Assessment

**Feasibility: Medium-High, but requires significant refactoring.**

**What works in our favor:**
- The core game logic (concepts, proximity synthesis, scoring) is framework-agnostic -- it's all React state + hooks
- Meta Quest browser supports WebXR with both hand tracking and controllers
- `@react-three/fiber` (v8 for React 18) + `@react-three/xr` provide a solid WebXR integration path
- Three.js has mature WebXR support including hand tracking (`XRHand`) and controller models

**What needs to happen:**
- The entire 2D Canvas rendering pipeline (`ConceptRenderer`, `SphereRenderer`, `ConnectionRenderer`, `BackgroundRenderer`) would need to be **replaced** with a Three.js scene graph (meshes, materials, lights)
- Glass beads become `SphereGeometry` with `MeshPhysicalMaterial` (transmission, roughness for glass look)
- The wireframe sphere becomes a `WireframeGeometry` or `LineSegments`
- Connections become `Line2` or tube geometries
- All pointer handlers (`useSimplifiedPointerHandlers`, `useInteractions`) would be replaced by XR controller/hand interaction hooks from `@react-three/xr`

**Core XR interactions (all feasible):**
- **Grab sphere to rotate:** XR grab on the sphere mesh, track controller/hand delta to rotate
- **Pinch to scale:** Two-hand grab, measure distance change, scale sphere
- **Grab and move beads:** XR grab on individual bead meshes, constrain to sphere surface on release
- **Hand tracking:** `@react-three/xr` exposes `useHand()` with joint positions; pinch gesture = grab

**Recommended approach:** Build a parallel `WebXRArena` component that shares game logic hooks but renders via Three.js instead of 2D Canvas. Use feature detection (`navigator.xr?.isSessionSupported('immersive-vr')`) to offer the XR mode. This keeps the 2D canvas as the default for desktop/mobile.

**Effort estimate:** This is a standalone project-sized effort (multiple sessions). Not included in this implementation batch, but the architecture supports it cleanly since game logic is decoupled from rendering.

---

## 4. Color Scheme Overhaul

**Problem:** Current discipline colors are standard Tailwind defaults. Beads appear muddy against the dark purple background. UI text uses `game-text-dim` (desaturated purple-gray) which is hard to read.

**Changes:**

### Discipline colors -- more vibrant, higher saturation:
| Discipline | Current | New |
|---|---|---|
| Mathematics | `#3B82F6` (blue) | `#60A5FA` (brighter blue) |
| Music | `#10B981` (emerald) | `#34D399` (vivid mint) |
| Philosophy | `#8B5CF6` (purple) | `#A78BFA` (lighter violet) |
| Physics | `#F59E0B` (amber) | `#FBBF24` (bright gold) |
| Visual Arts | `#EF4444` (red) | `#FB7185` (vivid rose) |
| History | `#06B6D4` (cyan) | `#22D3EE` (bright cyan) |

### Bead rendering -- more color saturation:
- Increase the color intensity in the glass bead gradient (currently fades to 30% of RGB at edge -- change to 50%)
- Brighten the halo glow opacity from 0.25 to 0.35
- Add a colored rim light effect (thin bright stroke around each bead)

### Connection lines -- colorful instead of monochrome purple:
- Use the discipline colors of connected concepts as gradient endpoints instead of fixed `rgba(150, 120, 255, ...)`

### UI text improvements:
- `--game-text-bright`: Change from `0 0% 95%` to `0 0% 97%` (near white)
- `--game-text-dim`: Change from `240 10% 60%` to `220 15% 72%` (lighter, more readable)
- `SynthesisCard`, `ScoreDisplay`, `SessionHeader`: Ensure text contrast ratio meets WCAG AA against dark backgrounds
- Tutorial overlay: Use a slightly brighter background surface

**Files to edit:**
- `GlassBeadGame.tsx` -- discipline color definitions
- `ConceptRenderer.ts` -- bead gradient intensities, rim light
- `ConnectionRenderer.ts` -- discipline-colored gradients
- `SphereRenderer.ts` -- slightly brighter wireframe
- `index.css` -- game CSS custom properties
- `SynthesisCard.tsx`, `ScoreDisplay.tsx`, `SessionHeader.tsx` -- text color classes

---

## Implementation Order

1. **Color overhaul** (quick wins, immediately visible improvement)
2. **3D depth cues** (rotation inertia, depth opacity, scroll-wheel, hover)
3. **Discovery Log panel** (new component + wiring)
4. WebXR is documented as feasible; defer to a dedicated session

