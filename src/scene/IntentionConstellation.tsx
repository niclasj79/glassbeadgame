import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore as useVanillaStore } from "zustand";
import type { RelationIntention } from "@/domain/events";
import { isCoarsePointer } from "@/lib/device";
import { productionInterpretation } from "@/runtime/interpretation";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { useCurrentTheme } from "@/themes/useTheme";
import { frameState } from "./frameState";
import {
  PLATE_STATIONS,
  plateGeometry,
  type PlateGeometry,
  type PlateStation,
} from "./framing";

/**
 * THE INTENTION PLATE
 *
 * Four world-anchored stations engraved on a graduated ring around the
 * attended bead (I-006, I-014). The ring's centre is deliberately empty —
 * the bead itself is there — and the bead's own label steps aside while the
 * plate is open, which is what the previous fan got wrong.
 *
 * TWO REGISTERS, NOT ONE. The four verbs stand *on* the graduated circle.
 * Step-back and Details are not verbs, and they now hang on an index rail
 * *outside* it, on the upper diagonals, each on its own short arm. They used
 * to sit on the lower diagonals inside the same circle, which put six
 * controls in one diamond and — measured on a 414x896 touch viewport — left
 * 0.6 px between "Declare Tension" and "Step back". Two targets that close
 * are one target.
 *
 * Every size here is a consequence of the clearance law in `scene/framing.ts`
 * rather than a chosen number, and the same module hands the camera the safe
 * area this plate needs, so the camera can compose a pose the plate fits in.
 * A narrow viewport now opens the plate instead of shrinking it: small screen,
 * same fingers.
 *
 * THE PLATE OPENS IN THE POSE IT WILL BE AIMED AT — AND IT OPENS AT THE PRESS.
 *
 * Attending performs a camera lean, and the plate is anchored to a bead in the
 * world, so for as long as the lean is in flight the plate is a moving target.
 * Measured on the running build: the plate appeared 18 ms after the press at
 * (170, 201), was carried to (-18, 258) — more than half of it off the left
 * edge of the viewport — and only came to rest at (423, 293), 294 px away,
 * after three and a half seconds. Everything the player could aim at was
 * travelling for the whole of that.
 *
 * Waiting for the pose fixed the travelling and produced something worse: a
 * click set attention, the live region said "Choose an intention", and for
 * about three and a half seconds there was nothing on screen to choose from.
 *
 * Both are answered by the same law, and it is the world's own: a press holds
 * the sightline (`threading.beginGesture`), a held camera is a settled camera,
 * and a pose queued while the camera is held is abandoned rather than
 * performed. So attention is set on the way *down*, and the plate opens around
 * the bead under the finger — measured at 115 ms — in the pose the press was
 * made in, and then does not move. What the lean used to buy, the plate now
 * does for itself: it slides, by the least it can, to stay on the page.
 * A keyboard attend still performs the whole lean, and its plate still waits
 * for the pose to arrive, because nobody is aiming a pointer at it.
 *
 * THE PLATE HAS A GROUND. The graduated circle used to be struck straight over
 * whatever beads happened to lie inside it — on a 1280x720 frame the Prime
 * Numbers bead sat 53 px from the attended bead, directly under the Ground
 * station, and the ring's engraving ran through it. The plate now dims its own
 * footprint: an annulus of the world's own ground colour, transparent at the
 * centre so the attended bead is untouched and transparent again at the rim so
 * the plate has no edge.
 *
 * Every `data-testid`, element id, ARIA role and keyboard behaviour here is
 * part of the accepted interaction contract asserted by
 * `tests/browser/deterministic-mode.spec.ts`. The glyphs are string literals
 * (a previous revision put an escape sequence in JSX text and shipped the
 * literal characters `×` to the screen).
 */

interface IntentionOption {
  readonly intention: RelationIntention;
  readonly icon: string;
  readonly label: string;
  readonly description: string;
  /** Which engraved station of the plate this verb stands on. */
  readonly station: PlateStation;
}

/**
 * Content only. Where a station *is* — its bearing and which side its name
 * sits on — belongs to the plate's geometry, so the clearance law and the
 * rendered layout cannot drift apart.
 */
export const INTENTION_OPTIONS: readonly IntentionOption[] = Object.freeze([
  {
    intention: "echo",
    icon: "◌",
    label: "Echo",
    description: "shares a form",
    station: "north",
  },
  {
    intention: "passage",
    icon: "→",
    label: "Passage",
    description: "carries or transforms",
    station: "east",
  },
  {
    intention: "tension",
    icon: "≋",
    label: "Tension",
    description: "opposes or complicates",
    station: "south",
  },
  {
    intention: "ground",
    icon: "□",
    label: "Ground",
    description: "supports or embodies",
    station: "west",
  },
]);

function station(bearing: number, radius: number): React.CSSProperties {
  const radians = (bearing * Math.PI) / 180;
  return {
    left: `calc(50% + ${(Math.cos(radians) * radius).toFixed(2)}px)`,
    top: `calc(50% - ${(Math.sin(radians) * radius).toFixed(2)}px)`,
    transform: "translate(-50%, -50%)",
  };
}

/** The gradient the plate's ground is painted with. One plate, one id. */
const PLATE_GROUND_ID = "intention-plate-ground-fill";

/**
 * Consecutive frames the camera must report itself settled before the plate is
 * allowed to open. Two, because `frameState.cameraSettled` is written by
 * `CameraRig`'s frame callback and this component's runs first: on the frame an
 * attend is committed the flag still carries the previous frame's answer.
 */
const POSE_SETTLE_FRAMES = 2;

/**
 * …AND THE OTHER WAY THE POSE CAN ARRIVE.
 *
 * `cameraSettled` is `goal.current === null`, and a scripted move gives up its
 * goal either on arrival or after a 3.5 s timeout. A move whose pose the orbit
 * clamps cannot arrive: the camera comes to a complete stop within a second or
 * so and the flag stays false for the whole of the timeout, which is why a
 * keyboard attend left the plate unopened for three and a half seconds with
 * nothing moving on the screen at all.
 *
 * So the plate also opens when *the thing it is anchored to* has stopped. This
 * is the property that actually matters — the plate must open where it will
 * stay — and it is measured directly, in pixels, on the anchor itself. The
 * bound is tight on purpose: at a damped stop, a frame that moves less than
 * this has less than a handful of pixels of travel left in it.
 */
const STILL_PX = 0.14;
const STILL_FRAMES = 4;

/** The band an engraved station name occupies beyond its own station. */
const LABEL_BAND = 18;

/** How long an armed intention waits before it begins to insist. */
export const INSIST_AFTER_SECONDS = 9;
/** And how long it then takes to reach its full, still-quiet depth. */
export const INSIST_RAMP_SECONDS = 5;
/** How deep the insistence breathes. Light only, and bounded well short of a blink. */
export const INSIST_DEPTH = 0.34;

/** Scratch for the once-per-frame projection. Nothing here allocates. */
const screen = new THREE.Vector3();

/**
 * Has the pose this plate will be aimed at arrived?
 *
 * `last` carries the previous frame's anchor point and whether there was one:
 * three numbers in an array the caller owns, so asking the question costs no
 * allocation on the frame path.
 */
function poseArrived(
  settledFrames: MutableRefObject<number>,
  stillFrames: MutableRefObject<number>,
  last: MutableRefObject<Float32Array>,
  x: number,
  y: number
): boolean {
  settledFrames.current = frameState.cameraSettled
    ? settledFrames.current + 1
    : 0;
  const previous = last.current;
  stillFrames.current =
    previous[2] > 0 && Math.hypot(x - previous[0], y - previous[1]) < STILL_PX
      ? stillFrames.current + 1
      : 0;
  previous[0] = x;
  previous[1] = y;
  previous[2] = 1;
  return (
    settledFrames.current >= POSE_SETTLE_FRAMES ||
    stillFrames.current >= STILL_FRAMES
  );
}

/**
 * The index rail's two controls. The hit box keeps the fingertip minimum the
 * clearance law is measured against; the drawn mark is deliberately of another
 * class — smaller, unfilled, unshadowed — because these are not verbs.
 */
const UTILITY_TARGET =
  "pointer-events-auto absolute grid place-items-center rounded-full bg-transparent text-dim/70 transition-colors hover:text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow";
const UTILITY_MARK =
  "grid h-[26px] w-[26px] place-items-center rounded-full border border-line/35 bg-void/45 text-[13px] leading-none";

const LABEL_PLACEMENT: Readonly<
  Record<(typeof PLATE_STATIONS)[PlateStation]["labelPlacement"], string>
> = Object.freeze({
    above: "bottom-full mb-1.5 left-1/2 -translate-x-1/2",
    below: "top-full mt-1.5 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  });

/**
 * The engraved plate behind the stations. Decoration; never a hit target.
 * Strokes come from the world's own palette rather than a utility class, so
 * the ring is guaranteed to read against the arena at any theme.
 *
 * The index arms are drawn here too — two short strokes reaching out from the
 * graduated circle to the utility rail — so the second register is visibly
 * mounted on the instrument rather than floating beside it.
 */
function Plate({
  armed,
  brass,
  gold,
  ground,
  plate,
}: {
  armed: boolean;
  brass: string;
  gold: string;
  ground: string;
  plate: PlateGeometry;
}) {
  const graduations = Array.from({ length: 48 }, (_, i) => i);
  const rule = armed ? gold : brass;
  const radius = plate.ring;
  const box = plate.box;
  const armStart = radius + 8;
  const armEnd = plate.railRadius - plate.utility / 2 - 5;
  return (
    <svg
      aria-hidden="true"
      viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {/* The plate's own ground: it clears a radius for the instrument by
          sinking whatever the arena has left inside the ring. Transparent at
          the centre — the attended bead is there and must not be dimmed — and
          transparent again at the rim, so the plate is a face and not a disc. */}
      <defs>
        <radialGradient id={PLATE_GROUND_ID}>
          <stop offset="0%" stopColor={ground} stopOpacity={0} />
          <stop offset="26%" stopColor={ground} stopOpacity={0} />
          <stop offset="52%" stopColor={ground} stopOpacity={0.62} />
          <stop offset="92%" stopColor={ground} stopOpacity={0.62} />
          <stop offset="100%" stopColor={ground} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle
        data-testid="intention-plate-ground"
        r={radius}
        fill={`url(#${PLATE_GROUND_ID})`}
      />
      <circle r={radius} fill="none" stroke={rule} strokeOpacity={0.75} strokeWidth={1} />
      <circle
        r={radius - 8}
        fill="none"
        stroke={rule}
        strokeOpacity={armed ? 0.55 : 0.3}
        strokeWidth={0.6}
      />
      {graduations.map((i) => {
        const angle = (i / graduations.length) * Math.PI * 2;
        const major = i % 12 === 0;
        const outer = radius;
        const inner = radius - (major ? 10 : 4.5);
        return (
          <line
            key={i}
            x1={Math.cos(angle) * inner}
            y1={Math.sin(angle) * inner}
            x2={Math.cos(angle) * outer}
            y2={Math.sin(angle) * outer}
            stroke={rule}
            strokeOpacity={major ? 0.85 : 0.4}
            strokeWidth={major ? 1.4 : 0.7}
          />
        );
      })}
      {plate.railBearings.map((bearing) => {
        const radians = (bearing * Math.PI) / 180;
        return (
          <line
            key={`arm-${bearing}`}
            x1={Math.cos(radians) * armStart}
            y1={-Math.sin(radians) * armStart}
            x2={Math.cos(radians) * armEnd}
            y2={-Math.sin(radians) * armEnd}
            stroke={brass}
            strokeOpacity={0.32}
            strokeWidth={0.8}
          />
        );
      })}
    </svg>
  );
}

/**
 * How far the plate may slide to stay on the page, and what it protects first.
 *
 * The plate is anchored to a bead, and a bead near an edge is a plate over the
 * edge. The camera used to solve this by leaning until the plate fitted, and
 * paid for it with three and a half seconds in which the press that demanded
 * the plate was answered by nothing at all. The plate now opens where the bead
 * is and slides — by the least it can — until it is on the page.
 *
 * When the page is too small to hold the whole plate at all (a phone is), what
 * is protected is the four verbs and their engraved names; the index rail's two
 * marks may clip, because they are not verbs. That is the same order of
 * degradation `framing.plateSafeArea` already applies to the camera.
 */
function slide(centre: number, extent: number, size: number): number {
  // Nothing can be done for a page this small, and a correction that cannot
  // succeed would only carry the plate off the opposite edge.
  if (extent * 2 > size) return 0;
  if (centre - extent < 0) return extent - centre;
  if (centre + extent > size) return size - (centre + extent);
  return 0;
}

/**
 * How much of that slide the plate may actually take.
 *
 * It stops when the attended bead would leave the ring drawn around it — a
 * plate that is not visibly *this bead's* plate is worse than a plate with a
 * clipped corner — and gives that bound up only for the one thing that may
 * never happen, which is a verb station over the edge of the page.
 */
function bounded(whole: number, verbs: number, ring: number): number {
  const limit = Math.max(ring, Math.abs(verbs));
  return Math.max(-limit, Math.min(limit, whole));
}

/**
 * How hard an armed intention nobody has drawn is insisting, 0 to 1.
 *
 * Measured naive: the ring was still open ninety seconds after the intention
 * was chosen, sixty-five of them after the last release, with no thread woven
 * and nothing on the screen changing. There is no timer in this Game and no
 * failure, so the intention is not taken away — it is still theirs, and they
 * have done nothing wrong. It says so instead, and it takes its time saying it.
 */
function insistence(armedSeconds: number): number {
  const over = (armedSeconds - INSIST_AFTER_SECONDS) / INSIST_RAMP_SECONDS;
  return over < 0 ? 0 : over > 1 ? 1 : over;
}

/**
 * The plate's three placement laws, gathered so a test can measure them
 * without standing up a renderer. They are pure; the component below is the
 * only thing that applies them.
 */
export const PLATE_PLACEMENT = Object.freeze({ slide, bounded, insistence });

/** A temporary world-bound intention plate; it is never a persistent HUD. */
export function IntentionConstellation() {
  const anchor = useRef<THREE.Group>(null);
  const pane = useRef<HTMLDivElement>(null);
  const theme = useCurrentTheme();
  const viewportWidth = useThree((s) => s.size.width);
  const plate = plateGeometry(
    viewportWidth,
    typeof window === "undefined" ? false : isCoarsePointer()
  );
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);
  const attendedId =
    draft.stage === "inactive" ? null : String(draft.attendedConceptId);

  /**
   * Whether the pose this plate will be aimed at has arrived. Latched: once the
   * plate is open, a later phrase — the breath on arming, a reveal — must never
   * take it away again, and it is reset only when attention moves to another
   * bead, which is the one case where the plate genuinely has to be re-placed.
   */
  const [posed, setPosed] = useState(false);
  const armedMark = useRef<HTMLDivElement>(null);
  const armedSeconds = useRef(0);
  const settledFrames = useRef(0);
  const stillFrames = useRef(0);
  const lastScreen = useRef(new Float32Array(3));
  useEffect(() => {
    settledFrames.current = 0;
    stillFrames.current = 0;
    lastScreen.current[2] = 0;
    setPosed(false);
  }, [attendedId]);

  useFrame((three, rawDt) => {
    if (draft.stage === "inactive") {
      armedSeconds.current = 0;
      return;
    }
    const dt = Math.min(rawDt, 1 / 20);

    /**
     * AN ARMED INTENTION THAT NOBODY DRAWS MUST NOT SIT THERE FOR EVER.
     *
     * Measured naive: the ring was still open ninety seconds after the
     * intention was chosen, sixty-five of them after the last release, with no
     * thread woven and nothing on the screen changing. The Game has no timers
     * and no failure, so the answer is not to take the intention away — the
     * player has not done anything wrong and it is still theirs. It *insists*
     * instead: after a while the armed mark begins to breathe, on the world's
     * own breath, bounded, in light rather than travel, so it is legible under
     * reduced motion and cannot become a flash. It says "this is still held",
     * which is the truth, and it never says it faster.
     */
    if (draft.stage === "armed" && !frameState.aim.active) {
      armedSeconds.current += dt;
    } else {
      armedSeconds.current = 0;
    }
    const mark = armedMark.current;
    if (mark) {
      const insist = insistence(armedSeconds.current);
      const breath = (1 - Math.cos(frameState.breathPhase)) / 2;
      mark.style.opacity = String(1 - insist * INSIST_DEPTH * breath);
    }
    const index = frameState.beadIndex.get(String(draft.attendedConceptId));
    if (index === undefined) return;
    const rendered = frameState.rendered;
    if (anchor.current) {
      anchor.current.position.set(
        rendered[index * 3],
        rendered[index * 3 + 1],
        rendered[index * 3 + 2]
      );
    }

    // Where the plate's anchor actually lands on the page, this frame.
    screen
      .set(rendered[index * 3], rendered[index * 3 + 1], rendered[index * 3 + 2])
      .project(three.camera);
    const x = ((screen.x + 1) / 2) * three.size.width;
    const y = ((1 - screen.y) / 2) * three.size.height;

    if (!posed) {
      if (poseArrived(settledFrames, stillFrames, lastScreen, x, y)) {
        setPosed(true);
      }
      return;
    }

    // The plate keeps itself on the page. A ref write, never React state: this
    // is solved on every frame and must not re-render the arena.
    const element = pane.current;
    if (!element) return;
    const verb = plate.ring + plate.station / 2 + LABEL_BAND;
    const dx = bounded(
      slide(x, plate.extentSide, three.size.width),
      slide(x, verb, three.size.width),
      plate.ring
    );
    const dy = bounded(
      slide(y, Math.max(plate.extentUp, plate.extentDown), three.size.height),
      slide(y, verb, three.size.height),
      plate.ring
    );
    element.style.transform =
      dx === 0 && dy === 0 ? "" : `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  });

  useEffect(() => {
    if (draft.stage !== "attending" || !attendedId) return;
    if (document.activeElement?.id !== `bead-control-${attendedId}`) return;
    let request = 0;
    let attempts = 0;
    /**
     * Existing is not the same as focusable, and the difference is a whole
     * frame. The plate is carried by drei's `Html`, which mounts its wrapper
     * with `display: none` and only reveals it from its own frame callback —
     * and `focus()` on a display-none element does nothing at all, silently.
     * This used to call `focus()` once the element existed and return whether
     * or not the focus had been taken, so a keyboard player whose plate was one
     * frame behind was simply left on the bead they had just opened.
     *
     * The bound is generous rather than tight because the plate now waits for
     * the attend pose to arrive, which is a whole camera phrase: sixty frames
     * expired long before the plate existed and put the keyboard player back
     * where the old bug had left them.
     */
    const focusWhenProjected = (): void => {
      const control = document.getElementById("intention-control-echo");
      if (control) {
        control.focus();
        if (document.activeElement === control) return;
      }
      attempts += 1;
      if (attempts < 420) request = window.requestAnimationFrame(focusWhenProjected);
    };
    request = window.requestAnimationFrame(focusWhenProjected);
    return () => window.cancelAnimationFrame(request);
  }, [attendedId, draft.stage]);

  if (draft.stage === "inactive" || !attendedId) return null;
  const selected = draft.stage === "attending" ? null : draft.intention;
  const selectedOption = INTENTION_OPTIONS.find(
    (option) => option.intention === selected
  );
  const stationSize = { minWidth: plate.station, minHeight: plate.station };
  const utilitySize = { width: plate.utility, height: plate.utility };
  const restoreAttendedFocus = (): void => {
    window.requestAnimationFrame(() => {
      document.getElementById(`bead-control-${attendedId}`)?.focus();
    });
  };
  const choose = (intention: RelationIntention, restoreFocus: boolean): void => {
    productionInterpretation.armIntention(intention);
    if (restoreFocus) restoreAttendedFocus();
  };
  const focusIntentionAt = (index: number): void => {
    const bounded =
      (index + INTENTION_OPTIONS.length) % INTENTION_OPTIONS.length;
    document
      .getElementById(
        `intention-control-${INTENTION_OPTIONS[bounded].intention}`
      )
      ?.focus();
  };

  // The anchor group is always here so the plate has a world position the
  // instant it is allowed to open; only the plate itself waits for the pose.
  if (!posed) return <group ref={anchor} />;

  return (
    <group ref={anchor}>
      <Html center style={{ pointerEvents: "none" }} zIndexRange={[18, 12]}>
        <div
          ref={pane}
          data-testid="intention-constellation"
          className="relative touch-none text-bright"
          style={{ width: plate.box, height: plate.box }}
        >
          <Plate
            armed={selectedOption !== undefined}
            brass={theme.palette.brass}
            gold={theme.palette.gold}
            ground={theme.palette.ground}
            plate={plate}
          />

          {draft.stage === "attending" ? (
            <div
              role="radiogroup"
              aria-label="Choose an intention for the attended bead"
              className="absolute inset-0"
            >
              {INTENTION_OPTIONS.map((option) => (
                <button
                  key={option.intention}
                  id={`intention-control-${option.intention}`}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  aria-label={`${option.label}: ${option.description}`}
                  data-world-intention={option.intention}
                  data-direct-hover="false"
                  data-testid={`intention-${option.intention}`}
                  style={{
                    ...station(
                      PLATE_STATIONS[option.station].bearing,
                      plate.ring
                    ),
                    ...stationSize,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    const index = INTENTION_OPTIONS.indexOf(option);
                    if (event.key === " ") {
                      event.preventDefault();
                      choose(option.intention, true);
                    } else if (
                      event.key === "ArrowRight" ||
                      event.key === "ArrowDown"
                    ) {
                      event.preventDefault();
                      focusIntentionAt(index + 1);
                    } else if (
                      event.key === "ArrowLeft" ||
                      event.key === "ArrowUp"
                    ) {
                      event.preventDefault();
                      focusIntentionAt(index - 1);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      focusIntentionAt(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      focusIntentionAt(INTENTION_OPTIONS.length - 1);
                    }
                  }}
                  onClick={(event) =>
                    choose(option.intention, event.detail === 0)
                  }
                  className="pointer-events-auto absolute grid place-items-center rounded-full border border-line/80 bg-void/85 text-bright shadow-[0_2px_14px_hsl(var(--void)/0.8)] backdrop-blur-[2px] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow data-[direct-hover=true]:scale-125 data-[direct-hover=true]:border-glow data-[direct-hover=true]:bg-glow/20"
                >
                  <span className="font-display text-xl leading-none" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span
                    className={`pointer-events-none absolute whitespace-nowrap font-ui text-[9px] uppercase tracking-[0.18em] text-dim ${LABEL_PLACEMENT[PLATE_STATIONS[option.station].labelPlacement]}`}
                  >
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          ) : selectedOption ? (
            <div
              ref={armedMark}
              aria-hidden="true"
              data-testid="armed-intention"
              title={`${selectedOption.label} armed`}
              style={{
                ...station(
                  PLATE_STATIONS[selectedOption.station].bearing,
                  plate.ring
                ),
                width: plate.station,
                height: plate.station,
              }}
              className="pointer-events-none absolute grid place-items-center rounded-full border border-glow/80 bg-glow/15 font-display text-2xl text-bright shadow-[0_0_26px_hsl(var(--glow)/0.35)] backdrop-blur-[2px]"
            >
              {selectedOption.icon}
            </div>
          ) : null}

          {/* The index rail: outside the graduated circle, on the upper
              diagonals, clear of every verb station and every engraved label
              by the clearance law in scene/framing.ts.

              A SECOND REGISTER HAS TO LOOK LIKE ONE. These two used to be
              44 px chips against the verbs' 48 px, with the same rule, the
              same fill, the same blur — six near-identical discs of which four
              were the interpretation and two were housekeeping. The *target*
              is still a fingertip (framing.UTILITY_SIZE, and the clearance law
              is measured against it); what is drawn inside it is now a mark
              little more than half the size, with no fill of its own and no
              shadow, so the eye reads four verbs and two indices. */}
          <button
            type="button"
            data-testid="world-cancel-interpretation"
            aria-label="Step back from this interpretation"
            style={{
              ...station(plate.railBearings[0], plate.railRadius),
              ...utilitySize,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => productionInterpretation.cancel()}
            className={UTILITY_TARGET}
          >
            <span aria-hidden="true" className={`${UTILITY_MARK} font-ui`}>
              ×
            </span>
          </button>
          <button
            type="button"
            data-testid="world-inspect-attended"
            aria-label="Details for the attended bead"
            style={{
              ...station(plate.railBearings[1], plate.railRadius),
              ...utilitySize,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() =>
              productionInterpretation.inspect(draft.attendedConceptId)
            }
            className={UTILITY_TARGET}
          >
            <span aria-hidden="true" className={`${UTILITY_MARK} font-display italic`}>
              i
            </span>
          </button>
        </div>
      </Html>
    </group>
  );
}
