import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
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
 * THE PLATE OPENS IN THE POSE IT WILL BE AIMED AT. Attending performs a camera
 * lean, and the plate is anchored to a bead in the world, so for as long as the
 * lean is in flight the plate is a moving target. Measured on the running
 * build: the plate appeared 18 ms after the press at (170, 201), was carried to
 * (-18, 258) — more than half of it off the left edge of the viewport — and
 * only came to rest at (423, 293), 294 px away, after three and a half seconds.
 * Everything the player could aim at was travelling for the whole of that.
 * So the plate now waits for the pose: the press is answered instantly by the
 * world (the bead takes light, the resonance bands publish, the instrument
 * turns), and the plate opens where it will stay.
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

/** A temporary world-bound intention plate; it is never a persistent HUD. */
export function IntentionConstellation() {
  const anchor = useRef<THREE.Group>(null);
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
  const settledFrames = useRef(0);
  useEffect(() => {
    settledFrames.current = 0;
    setPosed(false);
  }, [attendedId]);

  useFrame(() => {
    if (draft.stage === "inactive") return;
    if (!posed) {
      settledFrames.current = frameState.cameraSettled
        ? settledFrames.current + 1
        : 0;
      if (settledFrames.current >= POSE_SETTLE_FRAMES) setPosed(true);
    }
    if (!anchor.current) return;
    const index = frameState.beadIndex.get(String(draft.attendedConceptId));
    if (index === undefined) return;
    const rendered = frameState.rendered;
    anchor.current.position.set(
      rendered[index * 3],
      rendered[index * 3 + 1],
      rendered[index * 3 + 2]
    );
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
