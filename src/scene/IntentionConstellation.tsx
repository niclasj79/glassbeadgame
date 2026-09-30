import {
  useCallback,
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
import {
  INTENTION_VOCABULARY,
  type IntentionVocabulary,
} from "@/game/intentions";
import { isCoarsePointer } from "@/lib/device";
import { productionInterpretation } from "@/runtime/interpretation";
import { interpretationDraftStore } from "@/state/interactionDraft";
import { useFocusView } from "@/state/interpretationPresentation";
import { useCurrentTheme } from "@/themes/useTheme";
import { previewMidpoint } from "./curves";
import { frameState } from "./frameState";
import {
  PLATE_STATIONS,
  plateGeometry,
  type PlateGeometry,
  type PlateStation,
} from "./framing";
import { isSightlineHeld, sigilControlId, sigilHandlers } from "./threading";

/**
 * THE SIGIL PLATE — FOUR READINGS ON THE THREAD BETWEEN THE PAIR (I-016)
 *
 * Echo, Passage, Tension and Ground bloom only once a pair is locked, and they
 * bloom *on the preview thread between the two beads* — anchored halfway along
 * the unread strand (`curves.previewMidpoint`) — because the pair is the
 * object of the act and the reading is something said about the space between
 * them. They used to ring the attended bead and ask for a verb before the
 * object existed; five of nine September readings were Echo, chosen by
 * default. The plate appears exactly when the focus view says the sigils are
 * visible (`view.sigilsVisible`), and at no other time.
 *
 * Hovering a sigil *hears* its reading on the locked pair; pressing and
 * holding it weaves; releasing over it commits (`threading.sigilHandlers`).
 * All four are drawn identically. Nothing here knows a band, a fit, a facet or
 * a documented relation, so nothing here can mark, order, size or colour a
 * reading by what the record prefers: the only sigils ever drawn differently
 * are the chosen one (`aria-checked`) and the one under the pointer.
 *
 * TWO REGISTERS, NOT ONE. The four verbs stand *on* the graduated circle.
 * Step-back and Details are not verbs, and they hang on an index rail
 * *outside* it, on the upper diagonals, each on its own short arm. They used
 * to sit inside the same circle, which put six controls in one diamond and —
 * measured on a 414x896 touch viewport — left 0.6 px between "Declare Tension"
 * and "Step back". Two targets that close are one target.
 *
 * Every size here is a consequence of the clearance law in `scene/framing.ts`
 * rather than a chosen number. A narrow viewport opens the plate instead of
 * shrinking it: small screen, same fingers.
 *
 * THE PLATE OPENS IN THE POSE IT WILL BE AIMED AT.
 *
 * The plate is anchored in the world, so for as long as a camera phrase is in
 * flight it is a moving target — measured on an earlier build, a plate carried
 * 294 px across three and a half seconds while the player tried to aim at it.
 * So it waits for the pose: the camera settled for two frames, or the anchor
 * itself still for four. And it waits for the hand that locked the pair to let
 * go: a press holds the sightline (`threading.isSightlineHeld`), and a held
 * camera reports itself settled, so without that a plate would open in the
 * pose the press froze and then be carried off by the framing the lock asked
 * for. Once open it is latched until the pair itself changes.
 *
 * THE PLATE HAS A GROUND — a thin one. The engraving is laid over the world,
 * so it sinks a band beneath its own ring; the centre stays clear, because the
 * preview thread runs straight through it and is the thing being heard.
 *
 * Every `data-testid`, element id, ARIA role and keyboard behaviour here is
 * part of the accepted interaction contract. The glyphs are string literals
 * (a previous revision put an escape sequence in JSX text and shipped the
 * literal characters `×` to the screen).
 */

interface IntentionOption extends IntentionVocabulary {
  /** Which engraved station of the plate this verb stands on. */
  readonly station: PlateStation;
}

/**
 * Where each verb stands. The vocabulary itself — glyph, name, meaning — is in
 * `game/intentions.ts`, because the threshold screen introduces these before
 * the arena exists and a DOM screen must not import an R3F component to learn
 * what Echo is called. What is left here is the only part that is genuinely
 * about this instrument: where a station *is*, so the clearance law and the
 * rendered layout cannot drift apart. The order never changes with the pair.
 */
const STATIONS: Readonly<Record<RelationIntention, PlateStation>> = Object.freeze({
  echo: "north",
  passage: "east",
  tension: "south",
  ground: "west",
});

export const INTENTION_OPTIONS: readonly IntentionOption[] = Object.freeze(
  INTENTION_VOCABULARY.map((entry) =>
    Object.freeze({ ...entry, station: STATIONS[entry.intention] })
  )
);

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
 * `CameraRig`'s frame callback and this component's runs first: on the frame a
 * lock is committed the flag still carries the previous frame's answer.
 */
const POSE_SETTLE_FRAMES = 2;

/**
 * …AND THE OTHER WAY THE POSE CAN ARRIVE.
 *
 * A scripted move whose pose the orbit clamps cannot arrive: the camera stops
 * and `cameraSettled` stays false until the rig's timeout. So the plate also
 * opens when *the thing it is anchored to* has stopped, measured directly, in
 * pixels, on the anchor itself.
 */
const STILL_PX = 0.14;
const STILL_FRAMES = 4;

/** The band an engraved station name occupies beyond its own station. */
const LABEL_BAND = 18;

/** How long a chosen reading waits before it begins to insist. */
export const INSIST_AFTER_SECONDS = 9;
/** And how long it then takes to reach its full, still-quiet depth. */
export const INSIST_RAMP_SECONDS = 5;
/** How deep the insistence breathes. Light only, and bounded well short of a blink. */
export const INSIST_DEPTH = 0.34;

/** Scratch for the once-per-frame projection. Nothing here allocates. */
const screen = new THREE.Vector3();
const attendedAt = new THREE.Vector3();
const secondAt = new THREE.Vector3();
const midpoint = new THREE.Vector3();

/**
 * Has the pose this plate will be aimed at arrived?
 *
 * `last` carries the previous frame's anchor point and whether there was one:
 * three numbers in an array the caller owns, so asking the question costs no
 * allocation on the frame path. While a hand still holds the sightline nothing
 * is counted at all.
 */
function poseArrived(
  settledFrames: MutableRefObject<number>,
  stillFrames: MutableRefObject<number>,
  last: MutableRefObject<Float32Array>,
  x: number,
  y: number,
  sightlineHeld: boolean
): boolean {
  const previous = last.current;
  if (sightlineHeld) {
    settledFrames.current = 0;
    stillFrames.current = 0;
    previous[2] = 0;
    return false;
  }
  settledFrames.current = frameState.cameraSettled
    ? settledFrames.current + 1
    : 0;
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
      {/* The plate's own ground: a band of the world's ground colour beneath
          the engraving, so the ring is not struck straight over whatever the
          arena has left under it. Transparent through the centre — the
          preview thread runs through there, and it is what is being heard —
          and transparent again at the rim, so the plate is a face and not a
          disc. */}
      <defs>
        <radialGradient id={PLATE_GROUND_ID}>
          <stop offset="0%" stopColor={ground} stopOpacity={0} />
          <stop offset="58%" stopColor={ground} stopOpacity={0} />
          <stop offset="76%" stopColor={ground} stopOpacity={0.5} />
          <stop offset="94%" stopColor={ground} stopOpacity={0.5} />
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
 * The plate is anchored between two beads, and a pair near an edge is a plate
 * over the edge. It opens where the pair is and slides — by the least it can —
 * until it is on the page.
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
 * It stops when the thread's midpoint would leave the ring drawn around it — a
 * plate that is not visibly *this pair's* plate is worse than a plate with a
 * clipped corner — and gives that bound up only for the one thing that may
 * never happen, which is a verb station over the edge of the page.
 */
function bounded(whole: number, verbs: number, ring: number): number {
  const limit = Math.max(ring, Math.abs(verbs));
  return Math.max(-limit, Math.min(limit, whole));
}

/**
 * How hard a chosen reading nobody weaves is insisting, 0 to 1.
 *
 * There is no timer in this Game and no failure, so a chosen reading is never
 * taken away — it is still the player's, and they have done nothing wrong. It
 * says so instead, and it takes its time saying it.
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

/**
 * Whether focus arrived by keyboard. A plate that closes under a pointer's
 * focus has nothing to hand back; one that closes under the keyboard's must
 * not drop it on the page.
 */
function focusIsVisible(target: EventTarget): boolean {
  if (!(target instanceof Element)) return false;
  try {
    return target.matches(":focus-visible");
  } catch {
    return true;
  }
}

/** A temporary world-bound sigil plate; it is never a persistent HUD. */
export function IntentionConstellation() {
  const anchor = useRef<THREE.Group>(null);
  const pane = useRef<HTMLDivElement>(null);
  const theme = useCurrentTheme();
  const viewportWidth = useThree((s) => s.size.width);
  const plate = plateGeometry(
    viewportWidth,
    typeof window === "undefined" ? false : isCoarsePointer()
  );
  const view = useFocusView();
  const draft = useVanillaStore(interpretationDraftStore, (state) => state.draft);

  // The plate exists exactly when the focus view says the sigils are visible:
  // a locked pair, with or without a chosen reading.
  const attendedConcept = view.sigilsVisible ? view.attendedConceptId : null;
  const secondConcept = view.sigilsVisible ? view.secondConceptId : null;
  const attendedId = attendedConcept === null ? null : String(attendedConcept);
  const secondId = secondConcept === null ? null : String(secondConcept);
  const pairKey =
    attendedId === null || secondId === null ? null : `${attendedId} ${secondId}`;
  const selected = draft.stage === "reading" ? draft.intention : null;

  /**
   * Whether the pose this plate will be aimed at has arrived. Latched: once the
   * plate is open, a later phrase must never take it away again, and it is
   * reset only when the pair changes — a re-lock is the one case where the
   * plate genuinely has to be re-placed.
   */
  const [posed, setPosed] = useState(false);
  const armedMark = useRef<HTMLSpanElement | null>(null);
  const armedFor = useRef<RelationIntention | null>(null);
  const armedSeconds = useRef(0);
  const settledFrames = useRef(0);
  const stillFrames = useRef(0);
  const lastScreen = useRef(new Float32Array(3));
  useEffect(() => {
    settledFrames.current = 0;
    stillFrames.current = 0;
    lastScreen.current[2] = 0;
    setPosed(false);
  }, [pairKey]);

  /**
   * The chosen reading's glyph is the one mark that may insist. A callback
   * ref, so a mark that stops being the chosen one also stops breathing
   * instead of keeping whatever opacity it was last given.
   */
  const markArmed = useCallback((element: HTMLSpanElement | null) => {
    const previous = armedMark.current;
    if (previous !== null && previous !== element) previous.style.opacity = "";
    armedMark.current = element;
  }, []);

  useFrame((three, rawDt) => {
    if (attendedId === null || secondId === null) {
      armedSeconds.current = 0;
      return;
    }
    const dt = Math.min(rawDt, 1 / 20);

    /**
     * A CHOSEN READING THAT NOBODY WEAVES MUST NOT SIT THERE FOR EVER.
     *
     * The Game has no timers and no failure, so the answer is not to take the
     * reading away — the player has not done anything wrong and it is still
     * theirs. It *insists* instead: after a while the chosen mark begins to
     * breathe, on the world's own breath, bounded, in light rather than
     * travel, so it is legible under reduced motion and cannot become a flash.
     * It says "this is still held", which is the truth, and it never says it
     * faster.
     */
    if (selected !== armedFor.current) {
      armedFor.current = selected;
      armedSeconds.current = 0;
    }
    if (selected !== null && !productionInterpretation.isHolding()) {
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

    const ia = frameState.beadIndex.get(attendedId);
    const ib = frameState.beadIndex.get(secondId);
    if (ia === undefined || ib === undefined) return;
    const rendered = frameState.rendered;
    attendedAt.set(rendered[ia * 3], rendered[ia * 3 + 1], rendered[ia * 3 + 2]);
    secondAt.set(rendered[ib * 3], rendered[ib * 3 + 1], rendered[ib * 3 + 2]);
    // Halfway along the unread strand between the pair — the same point
    // whatever reading is being heard, so the sigil under the pointer never
    // moves away from it.
    previewMidpoint(attendedAt, secondAt, midpoint);
    if (anchor.current) anchor.current.position.copy(midpoint);

    // Where the plate's anchor actually lands on the page, this frame.
    screen.copy(midpoint).project(three.camera);
    const x = ((screen.x + 1) / 2) * three.size.width;
    const y = ((1 - screen.y) / 2) * three.size.height;

    if (!posed) {
      if (poseArrived(settledFrames, stillFrames, lastScreen, x, y, isSightlineHeld())) {
        setPosed(true);
      }
      return;
    }

    // The plate keeps itself on the page. A ref write, never React state: this
    // is solved on every frame and must not re-render the arena. No easing:
    // the correction is a placement, not a journey, under any motion setting.
    const element = pane.current;
    if (!element) return;
    const verb = plate.ring + plate.station / 2 + LABEL_BAND;
    const dx = bounded(
      slide(x, plate.extentSide, three.size.width),
      slide(x, verb, three.size.width),
      plate.ring
    );
    const dy = bounded(
      slide(y, Math.max(plate.extentUp, verb), three.size.height),
      slide(y, verb, three.size.height),
      plate.ring
    );
    element.style.transform =
      dx === 0 && dy === 0 ? "" : `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  });

  const candidateId =
    draft.stage === "locked" || draft.stage === "reading"
      ? String(draft.candidateConceptId)
      : null;
  useEffect(() => {
    if (draft.stage !== "locked" || !candidateId) return;
    if (document.activeElement?.id !== `bead-control-${candidateId}`) return;
    let request = 0;
    let attempts = 0;
    /**
     * A KEYBOARD PLAYER ARRIVES ON THE PLATE THEY JUST OPENED.
     *
     * Existing is not the same as focusable, and the difference is a whole
     * frame. The plate is carried by drei's `Html`, which mounts its wrapper
     * with `display: none` and only reveals it from its own frame callback —
     * and `focus()` on a display-none element does nothing at all, silently.
     * So this keeps asking until the focus has actually been taken.
     *
     * The bound is generous rather than tight because the plate waits for the
     * lock's pose to arrive, which is a whole camera phrase.
     */
    const focusWhenProjected = (): void => {
      const control = document.getElementById(sigilControlId("echo"));
      if (control) {
        control.focus();
        if (document.activeElement === control) return;
      }
      attempts += 1;
      if (attempts < 420) request = window.requestAnimationFrame(focusWhenProjected);
    };
    request = window.requestAnimationFrame(focusWhenProjected);
    return () => window.cancelAnimationFrame(request);
  }, [candidateId, draft.stage]);

  /**
   * …AND LEAVES IT WITHOUT BEING DROPPED ON THE PAGE.
   *
   * The plate closes under the keyboard's focus when Enter weaves, or when
   * Escape or Step back returns to attending. Focus on a removed element falls
   * to the document, and the next Tab starts from the top of the page. So the
   * keyboard is handed back to the second bead's control in the accessible
   * mirror — the bead it was last on — unless it has already gone somewhere
   * on purpose.
   */
  const keyboardOnPlate = useRef(false);
  const lastSecond = useRef<string | null>(null);
  useEffect(() => {
    if (secondId !== null) {
      lastSecond.current = secondId;
      return;
    }
    if (!keyboardOnPlate.current) return;
    keyboardOnPlate.current = false;
    const returnTo = lastSecond.current;
    const active = document.activeElement;
    if (returnTo === null || (active !== null && active !== document.body)) return;
    const request = window.requestAnimationFrame(() => {
      document.getElementById(`bead-control-${returnTo}`)?.focus();
    });
    return () => window.cancelAnimationFrame(request);
  }, [secondId]);

  if (attendedConcept === null || pairKey === null) return null;

  // The anchor group is always here so the plate has a world position the
  // instant it is allowed to open; only the plate itself waits for the pose.
  if (!posed) return <group ref={anchor} />;

  const stationSize = { minWidth: plate.station, minHeight: plate.station };
  const utilitySize = { width: plate.utility, height: plate.utility };
  // One stop in the tab order, as a radiogroup has: the chosen reading, or the
  // first when none is chosen. The arrows move within the group.
  const tabStop = selected ?? INTENTION_OPTIONS[0].intention;

  return (
    <group ref={anchor}>
      <Html center style={{ pointerEvents: "none" }} zIndexRange={[18, 12]}>
        <div
          ref={pane}
          data-testid="intention-constellation"
          className="relative touch-none text-bright"
          style={{ width: plate.box, height: plate.box }}
          onFocus={(event) => {
            keyboardOnPlate.current = focusIsVisible(event.target);
          }}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            // Focus leaving for nowhere is the plate closing under it (or the
            // window going away), not the keyboard choosing to go elsewhere.
            if (next !== null) keyboardOnPlate.current = false;
          }}
        >
          <Plate
            armed={selected !== null}
            brass={theme.palette.brass}
            gold={theme.palette.gold}
            ground={theme.palette.ground}
            plate={plate}
          />

          <div
            role="radiogroup"
            aria-label="Choose how you read the pair"
            className="absolute inset-0"
          >
            {INTENTION_OPTIONS.map((option) => {
              const checked = option.intention === selected;
              return (
                <button
                  key={option.intention}
                  id={sigilControlId(option.intention)}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={option.intention === tabStop ? 0 : -1}
                  aria-label={`${option.label}: ${option.description}`}
                  title={`${option.label} — ${option.description}`}
                  data-world-intention={option.intention}
                  data-testid={`intention-${option.intention}`}
                  style={{
                    ...station(PLATE_STATIONS[option.station].bearing, plate.ring),
                    ...stationSize,
                  }}
                  {...sigilHandlers(option.intention)}
                  className="group pointer-events-auto absolute grid place-items-center rounded-full border border-line/80 bg-void/85 text-bright shadow-[0_2px_14px_hsl(var(--void)/0.8)] backdrop-blur-[2px] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow aria-checked:border-glow aria-checked:bg-glow/15 [&:focus-visible_.gloss]:opacity-100"
                >
                  <span
                    ref={checked ? markArmed : undefined}
                    className="font-display text-xl leading-none"
                    aria-hidden="true"
                  >
                    {option.icon}
                  </span>
                  {/*
                    Four abstract nouns with no verb attached is the single
                    thing a first-time player is most likely to stall on. The
                    gloss the pack already writes for each — "shares a form",
                    "carries or transforms" — appears under the sigil the moment
                    the pointer or the keyboard reaches it, and disappears again
                    so it never becomes chrome.
                  */}
                  <span
                    className={`pointer-events-none absolute whitespace-nowrap ${LABEL_PLACEMENT[PLATE_STATIONS[option.station].labelPlacement]}`}
                  >
                    <span className="block font-ui text-[9px] uppercase tracking-[0.18em] text-dim">
                      {option.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className="gloss mt-0.5 block font-ui text-[9px] normal-case tracking-[0.06em] text-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    >
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* The index rail: outside the graduated circle, on the upper
              diagonals, clear of every verb station and every engraved label
              by the clearance law in scene/framing.ts.

              A SECOND REGISTER HAS TO LOOK LIKE ONE. The *target* is still a
              fingertip (framing.UTILITY_SIZE, and the clearance law is
              measured against it); what is drawn inside it is a mark little
              more than half the size, with no fill of its own and no shadow,
              so the eye reads four verbs and two indices. */}
          <button
            type="button"
            data-testid="world-cancel-interpretation"
            aria-label="Step back from this interpretation"
            style={{
              ...station(plate.railBearings[0], plate.railRadius),
              ...utilitySize,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              productionInterpretation.cancel();
            }}
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
            onClick={(event) => {
              event.stopPropagation();
              productionInterpretation.inspect(attendedConcept);
            }}
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
