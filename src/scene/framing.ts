import * as THREE from "three";
import { ARENA_RADIUS } from "@/game/layout";
import { MAX_BEAD_EXTENT } from "./rings";

/**
 * HOW THE WORLD IS COMPOSED ON THE SCREEN
 *
 * Five things live here, and they live together because they are one problem:
 * a frame is only well composed if the camera, the instrument, the plate and
 * the phrasing of the move all agree about where the edges are.
 *
 *   1. THE FRAME     the safe area — how close anything drawn around a bead
 *                    may come to a viewport edge, and how large the intention
 *                    plate actually is once its labels are counted.
 *   2. THE HOME      where the instrument sits when nothing is being attended:
 *                    a composed rest pose, not the middle of the rectangle.
 *   3. THE LEVEL     where the world's horizon lands for a given elevation,
 *                    and therefore how far the camera may rise before the
 *                    level sweeps out of frame.
 *   4. THE POSTURE   the attended pose, solved rather than nudged.
 *   5. THE PHRASING  one tempo, and every camera move a whole or half multiple
 *                    of it, damped in orbit coordinates so a move is always a
 *                    turn of the instrument and never a cut through it.
 *
 * All of it is pure, and therefore testable without a renderer. Nothing here
 * allocates on a frame path: the dampers write through carriers the caller
 * owns.
 */

/* ────────────────────────────────────────────────────────────────────── *
 * 1. THE FRAME
 * ────────────────────────────────────────────────────────────────────── */

/** Vertical field of view of the arena camera, in degrees. */
export const ARENA_FOV = 42;

const tanHalfFov = (fov: number): number => Math.tan((fov * Math.PI) / 360);

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/**
 * The box, in NDC, that the *anchor* of a screen-space plate must stay inside
 * so that no part of the plate — including its outermost engraved label —
 * can reach a viewport edge. It is not symmetric: the plate is not.
 */
export interface SafeArea {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Fingertip minimum for a verb station, in CSS pixels. */
export const STATION_SIZE = 48;
/** The two utility controls are smaller, because they are not verbs. */
export const UTILITY_SIZE = 44;
/**
 * No two controls — and no control and a neighbouring label — may come closer
 * than this. Below it two targets are one target, whatever the design says.
 */
export const CONTROL_CLEARANCE = 24;

/**
 * The smallest ring radius at which two adjacent verb stations are still two
 * separate targets. Four cardinal stations on a ring of radius r are separated
 * by (r, r), so their boxes clear each other by exactly `r - STATION_SIZE`.
 */
export const MIN_RING_RADIUS = STATION_SIZE + CONTROL_CLEARANCE;

/**
 * A narrow viewport is a phone whatever it claims about pointers, and a coarse
 * pointer is a finger at any width — either one gets the open plate. The plate
 * used to *shrink* below this width, which put four fingertip targets and two
 * more inside a 124 px circle.
 */
export const COMPACT_VIEWPORT = 560;

const RING_RADIUS_FINE = 86;
const RING_RADIUS_TOUCH = 80;

/** Nominal box of an engraved station label, in CSS pixels. */
const LABEL_HALF_WIDTH = 30;
const LABEL_HEIGHT = 11;
/** Gap between a station and its label, above/below and beside. */
const LABEL_GAP = 6;
const LABEL_GAP_SIDE = 8;

/**
 * How far beneath the plate the attended bead's own name hangs — and, because
 * the plate is what a *neighbouring* name would collide with, the screen radius
 * `scene/labels.ts` reserves around an attended bead. `scene/Beads.tsx` used to
 * carry a second copy of this number; it imports this one now.
 */
export const ATTENDED_LABEL_DROP_PX = 148;
const ATTENDED_LABEL_HALF_HEIGHT = 10;

/**
 * A few pixels of air past the outermost thing the plate draws. "Must not
 * reach the edge" is not "may be tangent to it": a bound solved to exactly
 * zero clearance lands on the edge as soon as anything rounds.
 */
const SAFE_MARGIN = 3;

/**
 * The measured plate. Every number is derived from the clearance law rather
 * than authored, so a change to the fingertip minimum moves the whole plate
 * instead of quietly breaking one gap.
 */
export interface PlateGeometry {
  /** Radius of the engraved ring the four verbs stand on, in CSS pixels. */
  readonly ring: number;
  /** Hit size of a verb station. */
  readonly station: number;
  /** Hit size of a utility control. */
  readonly utility: number;
  /** Radius of the utility rail, outside the graduated circle. */
  readonly railRadius: number;
  /** Bearings of the two utility controls, degrees counter-clockwise of east. */
  readonly railBearings: readonly [number, number];
  /** Side of the square the plate is drawn into. */
  readonly box: number;
  /** Distance from the anchored bead to the plate's outermost pixel, per side. */
  readonly extentUp: number;
  readonly extentDown: number;
  readonly extentSide: number;
}

/**
 * The utility rail is not placed, it is solved: the smallest radius on the
 * upper diagonals at which a utility control clears every verb station, and
 * every verb's engraved label, by `CONTROL_CLEARANCE`.
 */
function railRadiusFor(ring: number, station: number, utility: number): number {
  const widest = Math.max(station, LABEL_HALF_WIDTH * 2);
  const diagonal =
    Math.SQRT2 * (widest / 2 + utility / 2 + CONTROL_CLEARANCE);
  const clearOfRing = ring + utility / 2 + CONTROL_CLEARANCE;
  return Math.max(diagonal, clearOfRing);
}

/** Where the four verbs stand, and which side their engraved name sits on. */
export type PlateStation = "north" | "east" | "south" | "west";

export interface PlateStationLayout {
  /** Bearing in degrees, measured counter-clockwise from east. */
  readonly bearing: number;
  readonly labelPlacement: "above" | "below" | "left" | "right";
}

export const PLATE_STATIONS: Readonly<
  Record<PlateStation, PlateStationLayout>
> = Object.freeze({
  north: { bearing: 90, labelPlacement: "above" },
  east: { bearing: 0, labelPlacement: "right" },
  south: { bearing: 270, labelPlacement: "below" },
  west: { bearing: 180, labelPlacement: "left" },
});

/** A measured box on the plate, in CSS pixels, +x right and +y down. */
export interface PlateBox {
  readonly id: string;
  readonly kind: "verb" | "utility" | "label";
  /** The control a label belongs to, so a control is not measured against it. */
  readonly owner: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Separation between two boxes. Negative means they overlap. */
export function boxGap(a: PlateBox, b: PlateBox): number {
  return Math.max(
    Math.abs(a.x - b.x) - (a.width + b.width) / 2,
    Math.abs(a.y - b.y) - (a.height + b.height) / 2
  );
}

function atBearing(
  bearing: number,
  radius: number
): { readonly x: number; readonly y: number } {
  const radians = (bearing * Math.PI) / 180;
  return { x: Math.cos(radians) * radius, y: -Math.sin(radians) * radius };
}

/**
 * Every box the plate puts on the screen. This is what the clearance law is
 * asserted against — a law nobody can measure is a law nobody keeps.
 */
export function plateBoxes(plate: PlateGeometry): PlateBox[] {
  const boxes: PlateBox[] = [];
  for (const key of Object.keys(PLATE_STATIONS) as PlateStation[]) {
    const layout = PLATE_STATIONS[key];
    const at = atBearing(layout.bearing, plate.ring);
    boxes.push({
      id: key,
      kind: "verb",
      owner: key,
      x: at.x,
      y: at.y,
      width: plate.station,
      height: plate.station,
    });
    const outward = plate.station / 2;
    const label =
      layout.labelPlacement === "above"
        ? { dx: 0, dy: -(outward + LABEL_GAP + LABEL_HEIGHT / 2) }
        : layout.labelPlacement === "below"
          ? { dx: 0, dy: outward + LABEL_GAP + LABEL_HEIGHT / 2 }
          : layout.labelPlacement === "left"
            ? { dx: -(outward + LABEL_GAP_SIDE + LABEL_HALF_WIDTH), dy: 0 }
            : { dx: outward + LABEL_GAP_SIDE + LABEL_HALF_WIDTH, dy: 0 };
    boxes.push({
      id: `${key}-label`,
      kind: "label",
      owner: key,
      x: at.x + label.dx,
      y: at.y + label.dy,
      width: LABEL_HALF_WIDTH * 2,
      height: LABEL_HEIGHT,
    });
  }
  plate.railBearings.forEach((bearing, index) => {
    const at = atBearing(bearing, plate.railRadius);
    const id = index === 0 ? "cancel" : "inspect";
    boxes.push({
      id,
      kind: "utility",
      owner: id,
      x: at.x,
      y: at.y,
      width: plate.utility,
      height: plate.utility,
    });
  });
  return boxes;
}

export function plateGeometry(
  viewportWidth: number,
  coarsePointer: boolean
): PlateGeometry {
  const touch = coarsePointer || viewportWidth < COMPACT_VIEWPORT;
  const ring = Math.max(
    MIN_RING_RADIUS,
    touch ? RING_RADIUS_TOUCH : RING_RADIUS_FINE
  );
  const station = STATION_SIZE;
  const utility = UTILITY_SIZE;
  const railRadius = railRadiusFor(ring, station, utility);
  const extentUp = railRadius + utility / 2 + SAFE_MARGIN;
  const extentDown =
    Math.max(
      ring + station / 2 + LABEL_GAP + LABEL_HEIGHT,
      ATTENDED_LABEL_DROP_PX + ATTENDED_LABEL_HALF_HEIGHT
    ) + SAFE_MARGIN;
  const extentSide =
    Math.max(
      ring + station / 2 + LABEL_GAP_SIDE + LABEL_HALF_WIDTH * 2,
      railRadius / Math.SQRT2 + utility / 2
    ) + SAFE_MARGIN;
  return {
    ring,
    station,
    utility,
    railRadius,
    railBearings: [135, 45],
    box: Math.ceil(2 * extentUp),
    extentUp,
    extentDown,
    extentSide,
  };
}

/**
 * The margin's inner ruling, as a fraction of a half-height. Inside it is the
 * reading area; a plate that crosses it is drawn on the page's margin.
 *
 * `scene/MarginRule.tsx` strikes the rule from this constant.
 */
export const FRAME_RULE_INSET = 0.115;

/**
 * THE RULE IS A MARGIN, NOT A PROPORTION OF THE HEIGHT.
 *
 * The ruling used to be struck at `FRAME_RULE_INSET` half-heights on *both*
 * axes. On a 16:9 frame that is a 6.5% side margin and an 11.5% top margin —
 * fine. On a 414x896 phone the same number is a **25% side margin**: the page's
 * left and right rules stand at NDC ±0.75, a quarter of the width gone to
 * ornament, which is why the portrait arena had nowhere left to be and ran over
 * its own frame instead.
 *
 * A margin is a physical width. Measuring it against the *short* side of the
 * page gives the same band on every side of every viewport, which is what a
 * ruled page actually looks like.
 */
export function frameRuleShared(aspect: number): number {
  return FRAME_RULE_INSET * Math.min(1, Math.max(aspect, 0.1));
}

/** Where the inner ruling stands, in NDC, on each axis. */
export function frameRuleNdc(aspect: number): {
  readonly x: number;
  readonly y: number;
} {
  const a = Math.max(aspect, 0.1);
  const shared = frameRuleShared(a);
  return { x: 1 - shared / a, y: 1 - shared };
}

/**
 * The safe area for a plate of this size in this viewport, in three steps of
 * degradation, because a phone genuinely cannot hold a fingertip-sized plate
 * inside the ruled margin and saying so is better than pretending:
 *
 *   1. inside the ruled margin, if the plate fits there;
 *   2. otherwise inside the viewport, which is the hard bound — nothing may
 *      ever be clipped;
 *   3. otherwise the centre of the frame, which is the best a viewport that
 *      small can offer.
 */
export function plateSafeArea(
  plate: PlateGeometry,
  viewport: Viewport
): SafeArea {
  const halfW = Math.max(1, viewport.width) / 2;
  const halfH = Math.max(1, viewport.height) / 2;
  const aspect = Math.max(0.1, viewport.width / Math.max(1, viewport.height));
  const shared = frameRuleShared(aspect);
  const horizontal = safeInterval(
    plate.extentSide / halfW,
    plate.extentSide / halfW,
    shared / aspect
  );
  const vertical = safeInterval(
    plate.extentDown / halfH,
    plate.extentUp / halfH,
    shared
  );
  return {
    minX: horizontal.min,
    maxX: horizontal.max,
    minY: vertical.min,
    maxY: vertical.max,
  };
}

/** One axis of the safe area: ruled margin, then viewport, then the centre. */
function safeInterval(
  low: number,
  high: number,
  rule: number
): { readonly min: number; readonly max: number } {
  const inset = low + high + rule * 2 < 2 ? rule : 0;
  if (low + high + inset * 2 >= 2) return { min: 0, max: 0 };
  return { min: -1 + inset + low, max: 1 - inset - high };
}

export function clampToSafeArea(
  ndcX: number,
  ndcY: number,
  area: SafeArea
): { readonly x: number; readonly y: number } {
  return {
    x: clamp(ndcX, area.minX, area.maxX),
    y: clamp(ndcY, area.minY, area.maxY),
  };
}

export function withinSafeArea(
  ndcX: number,
  ndcY: number,
  area: SafeArea,
  epsilon = 1e-3
): boolean {
  return (
    ndcX >= area.minX - epsilon &&
    ndcX <= area.maxX + epsilon &&
    ndcY >= area.minY - epsilon &&
    ndcY <= area.maxY + epsilon
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 * 2. THE HOME COMPOSITION
 * ────────────────────────────────────────────────────────────────────── */

/**
 * THE ARENA IS NOT A BULLSEYE.
 *
 * Measured on the shipped build: the centre of visual mass of the opening arena
 * frame sat at (1469, 812) against a frame centre of (1440, 810) — 1.0% off
 * horizontally, 0.1% off vertically, with column-thirds mass 20/63/17 and
 * row-thirds 31/37/32. That is not a composition. It is a round object dropped
 * in the middle of a rectangle, and it looked the same on every seed because
 * nothing about it was authored.
 *
 * Three commitments replace it, and all three are measurable here rather than
 * from a screenshot:
 *
 *   OFF-CENTRE HOME. The instrument's centre is carried to an authored fraction
 *   of the frame — about three-eighths across and just below the middle in
 *   landscape, high and centred in portrait — so one third dominates and the
 *   remaining space is *lead room* rather than leftover margin.
 *
 *   A RESERVED COLUMN AT REST. The margin the readings are written into is held
 *   open whether or not a reading is showing. A column that only appears when a
 *   note fires is a column the composition never had.
 *
 *   THE SILHOUETTE BREAKS THE RULE. The instrument crosses the page's inner
 *   ruling on one side instead of floating clear of all four, which is what
 *   makes it read as an object on a page rather than as a diagram in a box. The
 *   bead shell crosses nothing: no bead, ever, on any viewport.
 *
 * HOW IT IS DONE. Not by panning the aim point — the player's orbit turns about
 * that point, so an offset target unwinds the composition on the first drag,
 * and the auto-orbit would swing the whole arena across the screen. It is a
 * **lens shift**: an asymmetric frustum, exactly what a shift lens is for. An
 * off-axis perspective frustum translates the projected image by a constant in
 * NDC at every depth, so the composition is rigid under orbit, under zoom, and
 * under every scripted move — and the aim point stays on the arena's centre
 * where OrbitControls needs it.
 */

/** Below this aspect the frame is a portrait page: the margin runs along it. */
export const PORTRAIT_ASPECT = 1;

/**
 * THE MARGIN IS THE COLUMN'S REAL WIDTH, NOT A ROUND NUMBER.
 *
 * `ui/components/ReadingColumn` takes `min(27rem, 32vw)` down the right of a
 * wide page and `min-h-[30vh]` at the foot of a narrow one. The composition
 * used to answer that with the flat constant 0.36 on every viewport, which is
 * the right reserve on a 1024-wide tablet and 13.5 points too much on a 1920
 * desktop — measured at 1440x810 the composition held back to NDC 0.28 (screen
 * x 921) while the column's own edge stands at 1008, so 87 px belonged to
 * nobody and the instrument stood off further left than anything asked it to.
 *
 * The reserve is derived from the column's own rule now, so the two cannot
 * drift: widen the column and the world steps aside by exactly that much.
 */
export const READING_COLUMN_REM = 27;
export const READING_COLUMN_MAX_VW = 0.32;
export const READING_FOOT_VH = 0.3;
/** The root font size the column's `rem` measure is set in. */
export const ROOT_FONT_PX = 16;

/** The smallest reserve any page keeps, whatever its width. */
export const MARGIN_RESERVE = READING_FOOT_VH;

/** What the reading column actually takes on this page, as a fraction of it. */
export function marginReserve(viewport: Viewport): number {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  if (width / height < PORTRAIT_ASPECT) return READING_FOOT_VH;
  return Math.min(READING_COLUMN_MAX_VW, (READING_COLUMN_REM * ROOT_FONT_PX) / width);
}

/**
 * Where the instrument is seated inside its box, measured down from the box's
 * top. Not 0.5: a form seated fractionally low reads as resting in the frame,
 * and a form seated exactly halfway reads as having been dropped there.
 */
export const INSTRUMENT_SEAT = 0.54;

/**
 * HOW FAR OFF THE PAGE'S CENTRE THE INSTRUMENT IS SEATED — AUTHORED, NOT
 * LEFT OVER.
 *
 * The seat used to be *whatever fell out of* centring the instrument in the
 * box left after the margin, so its character changed with every viewport: on
 * 1024x768 it was a lead room, on 2560x1080 it was a rounding error, and on
 * 1920x1080 it would have been small enough to read as an unsuccessful centring
 * rather than as a decision. The instrument is now seated at least this far
 * toward the page's spine, and further only when the margin genuinely needs the
 * room. The reading is written on the other side of it.
 */
export const INSTRUMENT_LEAD = 0.24;

/**
 * How much of the half-frame the instrument's silhouette must leave between
 * itself and the viewport's own edge, on every axis.
 *
 * Breaking the page's *ruling* is the composition (see `broken` below): the
 * silhouette sits on the page rather than inside a box drawn on it. Reaching
 * the viewport edge is not that — it is a crop. At 1440x810 the rest pose put
 * the instrument's lowest brass 25 px off the bottom edge of an 810 px frame,
 * with no rule saying it had to and nothing red if it went further; on a phone
 * the same fit left 33 px at each side. This is the demand that stops it: the
 * silhouette keeps 4% of the frame — 32 px on an 810 px page — between itself
 * and every edge, on every axis, and the fit stands back until it can.
 */
export const INSTRUMENT_EDGE_CLEARANCE = 0.08;

/**
 * How far inside the ruling the bead shell must stay. A bead tangent to the
 * rule is a bead the rule cuts as soon as anything rounds.
 */
export const WORLD_SAFE_CLEARANCE = 0.03;

/**
 * The box no bead may leave, in NDC, for a frame of this aspect: inside the
 * page's ruling, with clearance. Labels are placed against this box too
 * (`scene/labels.ts`), which is why a label can never be the thing that runs
 * off the edge.
 */
export function worldSafeArea(aspect: number): SafeArea {
  const rule = frameRuleNdc(aspect);
  const x = Math.max(0.1, rule.x - WORLD_SAFE_CLEARANCE);
  const y = Math.max(0.1, rule.y - WORLD_SAFE_CLEARANCE);
  return { minX: -x, maxX: x, minY: -y, maxY: y };
}

export type FrameEdge = "left" | "right" | "top" | "bottom";

/**
 * The three laws the rest fit can be tight against.
 *
 *   shell   the bead shell reached the page's ruling — no bead may cross it;
 *   margin  the silhouette reached the column the readings are written in;
 *   page    the silhouette reached the clearance it keeps from the viewport.
 */
export type FitLaw = "shell" | "margin" | "page";

/**
 * The region of the page the instrument is composed into: the safe area on
 * three sides, and the margin on the fourth. This box, and not the frame, is
 * what the arena is centred in — which is the whole of why the arena stops
 * being centred in the frame.
 */
export function compositionBox(viewport: Viewport): SafeArea {
  const aspect = Math.max(0.1, Math.max(1, viewport.width) / Math.max(1, viewport.height));
  const safe = worldSafeArea(aspect);
  const edge = -1 + 2 * marginReserve(viewport);
  return aspect < PORTRAIT_ASPECT
    ? { ...safe, minY: edge }
    : { ...safe, maxX: -edge };
}

export interface HomeComposition {
  /** Orbit distance the rest pose holds. */
  readonly distance: number;
  /** Where the arena's centre is carried to, in NDC. */
  readonly centre: { readonly x: number; readonly y: number };
  /**
   * The lens shift, in pixels, for `PerspectiveCamera.setViewOffset`. Sign
   * convention is three's: a positive x renders a window further right in the
   * notional full image, which carries the world left.
   */
  readonly viewOffset: { readonly x: number; readonly y: number };
  /** Half-extent of the instrument's silhouette, in NDC. */
  readonly instrument: { readonly x: number; readonly y: number };
  /** Half-extent of the widest a bead ever reaches, in NDC. */
  readonly beads: { readonly x: number; readonly y: number };
  /** Ruled edges the instrument's silhouette crosses. */
  readonly broken: readonly FrameEdge[];
  /** The one side the fit is tight against — the fit is a solve, not a guess. */
  readonly tight: FrameEdge;
  /**
   * Which of the three laws that side is tight against, so a reader — and a
   * test — can tell "the bead shell reached the ruling" from "the silhouette
   * reached the page" without re-deriving the solve.
   */
  readonly against: FitLaw;
  /** The side the margin runs along. The instrument never enters it. */
  readonly margin: FrameEdge;
  /**
   * How much of the page is left clear of the instrument for the margin, as a
   * fraction of the width in landscape and of the height in portrait.
   */
  readonly reserve: number;
}

/**
 * The rest pose for a frame of this size: the distance at which the world
 * exactly fills its composition box, and the lens shift that carries it there.
 *
 * The distance is *solved*, not tuned. It used to be the constant 10.4 in
 * landscape and a width fit in portrait, and neither knew anything about where
 * a bead was allowed to be — which is how a phone ended up with the sphere
 * pushed off the left edge and 118px of unused margin on the right.
 *
 * Three demands, and the largest wins:
 *
 *   the bead shell inside the ruling, on both axes;
 *   the instrument clear of the margin;
 *   and nothing else. Every other edge is free to be broken, which is what
 *   lets the silhouette cross the rule rather than float clear of all four.
 */
export function homeComposition(
  viewport: Viewport,
  fov: number = ARENA_FOV
): HomeComposition {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const aspect = Math.max(0.1, width / height);
  const portrait = aspect < PORTRAIT_ASPECT;
  const safe = worldSafeArea(aspect);
  const box = compositionBox(viewport);

  // The seat is authored on the margin's axis and solved on the other: at
  // least INSTRUMENT_LEAD toward the spine, and further only where the margin
  // genuinely needs the room.
  const boxCentreX = (box.minX + box.maxX) / 2;
  const boxCentreY = box.maxY - INSTRUMENT_SEAT * (box.maxY - box.minY);
  const centre = portrait
    ? { x: boxCentreX, y: Math.max(boxCentreY, INSTRUMENT_LEAD) }
    : { x: Math.min(boxCentreX, -INSTRUMENT_LEAD), y: boxCentreY };

  const room = (a: number, b: number): number => Math.max(0.05, Math.min(a, b));
  const beadRoomX = room(centre.x - safe.minX, safe.maxX - centre.x);
  const beadRoomY = room(centre.y - safe.minY, safe.maxY - centre.y);
  const marginRoom = portrait ? centre.y - box.minY : box.maxX - centre.x;
  // The silhouette may cross the page's ruling; it may never reach the page.
  const edgeRoomX = room(
    1 - INSTRUMENT_EDGE_CLEARANCE + centre.x,
    1 - INSTRUMENT_EDGE_CLEARANCE - centre.x
  );
  const edgeRoomY = room(
    1 - INSTRUMENT_EDGE_CLEARANCE + centre.y,
    1 - INSTRUMENT_EDGE_CLEARANCE - centre.y
  );

  const demands: readonly (readonly [FrameEdge, FitLaw, number])[] = [
    [centre.y > 0 ? "bottom" : "top", "shell", MAX_BEAD_EXTENT / beadRoomY],
    [centre.x > 0 ? "left" : "right", "shell", MAX_BEAD_EXTENT / beadRoomX / aspect],
    [
      portrait ? "bottom" : "right",
      "margin",
      INSTRUMENT_HALF_SPAN /
        Math.max(0.05, marginRoom) /
        (portrait ? 1 : aspect),
    ],
    [centre.y > 0 ? "bottom" : "top", "page", INSTRUMENT_HALF_SPAN / edgeRoomY],
    [
      centre.x > 0 ? "left" : "right",
      "page",
      INSTRUMENT_HALF_SPAN / edgeRoomX / aspect,
    ],
  ];
  let tight: FrameEdge = demands[0][0];
  let against: FitLaw = demands[0][1];
  let halfH = 0;
  for (const [edge, law, demand] of demands) {
    if (demand > halfH) {
      halfH = demand;
      tight = edge;
      against = law;
    }
  }
  const halfW = halfH * aspect;
  const distance = halfH / tanHalfFov(fov);

  const instrument = {
    x: INSTRUMENT_HALF_SPAN / halfW,
    y: INSTRUMENT_HALF_SPAN / halfH,
  };
  const beads = { x: MAX_BEAD_EXTENT / halfW, y: MAX_BEAD_EXTENT / halfH };

  const rule = frameRuleNdc(aspect);
  const broken: FrameEdge[] = [];
  if (centre.x - instrument.x < -rule.x) broken.push("left");
  if (centre.x + instrument.x > rule.x) broken.push("right");
  if (centre.y + instrument.y > rule.y) broken.push("top");
  if (centre.y - instrument.y < -rule.y) broken.push("bottom");

  return {
    distance,
    centre,
    viewOffset: { x: (-centre.x * width) / 2, y: (centre.y * height) / 2 },
    instrument,
    beads,
    broken,
    tight,
    against,
    margin: portrait ? "bottom" : "right",
    reserve: portrait
      ? (1 + (centre.y - instrument.y)) / 2
      : (1 - (centre.x + instrument.x)) / 2,
  };
}

/**
 * THE TITLE IS A PLATE, NOT A PAGE.
 *
 * VC-05: the landscape title measured a luminance centroid at 55.4% of the
 * width — two thirds of its energy right of centre — while the armillary
 * behind it centred at about 34%. The two halves seesawed, with a collision in
 * the middle and 1100 px of nothing on the right, and the reason was one line
 * of code: the title used the *arena's* composition. The arena is seated off
 * the page's centre because a column down its right is held for the readings.
 * The title has no readings, no column, and nothing to lean away from — so it
 * inherited a lead room that answers a question it is not being asked.
 *
 * The title is composed concentrically instead, which is what the portrait
 * title already does and what makes it work: the wordmark is a plate set in the
 * middle of the instrument's own rings. The *fit* is untouched — same distance,
 * so the opening move keeps the dolly `scene/opening.ts` authored — and only
 * the lens shift differs, which `CameraRig` racks over the opening phrase
 * rather than cutting.
 *
 * `ui/screens/TitleScreen` has to meet it: the wordmark block is centred on the
 * page, so with the world centred on the page too, the two agree by
 * construction on every viewport instead of by two numbers that were never
 * compared.
 */
export function titleComposition(
  viewport: Viewport,
  fov: number = ARENA_FOV
): HomeComposition {
  const home = homeComposition(viewport, fov);
  const aspect = Math.max(0.1, Math.max(1, viewport.width) / Math.max(1, viewport.height));
  const rule = frameRuleNdc(aspect);
  const broken: FrameEdge[] = [];
  if (home.instrument.x > rule.x) broken.push("left", "right");
  if (home.instrument.y > rule.y) broken.push("top", "bottom");
  return {
    ...home,
    centre: { x: 0, y: 0 },
    viewOffset: { x: 0, y: 0 },
    broken,
    reserve: (1 - home.instrument.x) / 2,
  };
}

/* ────────────────────────────────────────────────────────────────────── *
 * 2b. THE REST FRAME, AS A MEASURABLE OBJECT
 * ────────────────────────────────────────────────────────────────────── */

/**
 * WHAT THE REST FRAME OWES A STRANGER.
 *
 * B5: at 1440x810 the instrument's silhouette stood between screen x 143 and
 * 847 — the left 59% of the page — with 25 px between its lowest brass and the
 * bottom edge of the viewport. Scaled to the frame's *height*, seated at its
 * *left*, and the remaining 40% of the width carrying two nav pills, a mute
 * button and the page's rule. Both faults were invisible to the tests, because
 * the composition only ever asserted things about *edges it was tight against*
 * and never about the frame as a whole.
 *
 * `restFrame` states the frame as numbers a test can hold: where the subject
 * sits, how much of each axis it spans, how far past the page's ruling it
 * reaches, and how near the page's own edge it comes. Frame fractions with +y
 * *down*, which is how a frame is measured off a screenshot, so what a critic
 * measures and what a test asserts are in the same units.
 */
export interface FrameBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface RestFrame {
  /** The instrument's silhouette, in frame fractions. */
  readonly silhouette: FrameBox;
  /** The widest the bead shell ever reaches, in frame fractions. */
  readonly shell: FrameBox;
  /** Centre of the silhouette, in frame fractions. */
  readonly centre: { readonly x: number; readonly y: number };
  /** How much of each axis the silhouette spans. */
  readonly fill: { readonly x: number; readonly y: number };
  /** How far past the page's ruling the silhouette reaches, per edge. 0 when clear. */
  readonly bleed: Readonly<Record<FrameEdge, number>>;
  /** How much frame is left between the silhouette and the viewport, per edge. */
  readonly clearance: Readonly<Record<FrameEdge, number>>;
}

/** NDC to frame fraction; y is flipped, because a frame is measured downward. */
const frameX = (ndc: number): number => (1 + ndc) / 2;
const frameY = (ndc: number): number => (1 - ndc) / 2;

export function restFrame(viewport: Viewport, fov: number = ARENA_FOV): RestFrame {
  const home = homeComposition(viewport, fov);
  const aspect = Math.max(0.1, Math.max(1, viewport.width) / Math.max(1, viewport.height));
  const rule = frameRuleNdc(aspect);
  const box = (half: { readonly x: number; readonly y: number }): FrameBox => ({
    minX: frameX(home.centre.x - half.x),
    maxX: frameX(home.centre.x + half.x),
    minY: frameY(home.centre.y + half.y),
    maxY: frameY(home.centre.y - half.y),
  });
  const silhouette = box(home.instrument);
  const past = (over: number): number => Math.max(0, over) / 2;
  return {
    silhouette,
    shell: box(home.beads),
    centre: { x: frameX(home.centre.x), y: frameY(home.centre.y) },
    fill: { x: home.instrument.x, y: home.instrument.y },
    bleed: {
      left: past(-rule.x - (home.centre.x - home.instrument.x)),
      right: past(home.centre.x + home.instrument.x - rule.x),
      top: past(home.centre.y + home.instrument.y - rule.y),
      bottom: past(-rule.y - (home.centre.y - home.instrument.y)),
    },
    clearance: {
      left: silhouette.minX,
      right: 1 - silhouette.maxX,
      top: silhouette.minY,
      bottom: 1 - silhouette.maxY,
    },
  };
}

/**
 * WHERE THE SUBJECT MAY SIT, AND HOW SMALL IT MAY GET.
 *
 * Two laws, stated here rather than discovered from a screenshot.
 *
 *   THE SUBJECT BOX. The instrument's centre must land inside this, on every
 *   supported viewport. It is deliberately *not* the middle of the frame — the
 *   reading is written to one side of the instrument and the composition leans
 *   the other way — and it is deliberately not the far third either, which is
 *   what B5 measured.
 *
 *   THE FLOOR ON FILL. No axis may be abandoned: whatever the aspect, the
 *   silhouette spans at least this much of both. A wide page cannot be filled
 *   by a sphere — at 21:9 a sphere fitted to the ruled height covers 37% of the
 *   width and no framing decision changes that — so the *room* has to carry the
 *   rest of the page. That is `scene/Firmament.tsx`'s side of this bargain, and
 *   it is measured where it can only be measured: on a rendered frame.
 */
export const REST_SUBJECT_BOX: Readonly<Record<"landscape" | "portrait", FrameBox>> =
  Object.freeze({
    landscape: Object.freeze({ minX: 0.34, maxX: 0.45, minY: 0.48, maxY: 0.58 }),
    portrait: Object.freeze({ minX: 0.44, maxX: 0.56, minY: 0.32, maxY: 0.44 }),
  });

/** No axis may be abandoned by the subject that fills the other one. */
export const ABANDONED_FILL = 0.34;

/**
 * The law B5 asked for, in one predicate: an axis may never be *both* crowded
 * to the page's own edge and paired with an axis the subject has abandoned.
 * The edge clearance is a demand inside `homeComposition`, so the first half is
 * structural; the second is a floor the fit has to keep.
 */
export function axesAgree(rest: RestFrame): boolean {
  const nearest = Math.min(
    rest.clearance.left,
    rest.clearance.right,
    rest.clearance.top,
    rest.clearance.bottom
  );
  const emptiest = Math.min(rest.fill.x, rest.fill.y);
  return (
    nearest >= INSTRUMENT_EDGE_CLEARANCE / 2 - 1e-9 &&
    emptiest >= ABANDONED_FILL - 1e-9
  );
}

/**
 * A world point's NDC once the lens shift is applied. The shift translates the
 * whole projected image by a constant, so this is an addition and not a second
 * projection.
 */
export function shiftNdc(
  ndcX: number,
  ndcY: number,
  home: HomeComposition
): { readonly x: number; readonly y: number } {
  return { x: ndcX + home.centre.x, y: ndcY + home.centre.y };
}

/** The inverse: where a solver must aim for a bead to *land* on `(x, y)`. */
export function unshiftNdc(
  ndcX: number,
  ndcY: number,
  home: HomeComposition
): { readonly x: number; readonly y: number } {
  return { x: ndcX - home.centre.x, y: ndcY - home.centre.y };
}

/** The same box, expressed in the un-shifted NDC the pose solver works in. */
export function unshiftArea(area: SafeArea, home: HomeComposition): SafeArea {
  return {
    minX: area.minX - home.centre.x,
    maxX: area.maxX - home.centre.x,
    minY: area.minY - home.centre.y,
    maxY: area.maxY - home.centre.y,
  };
}

/* ────────────────────────────────────────────────────────────────────── *
 * 3. THE LEVEL
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Where the world's horizon lands, in NDC, for a roll-free camera at this
 * elevation aimed at the arena's centre. The environment's lit band is the
 * y = 0 great circle of the sky, so the horizon is exactly `tan(elevation)`
 * over `tan(fov/2)` — it leaves the frame the moment the camera climbs past
 * half the field of view.
 */
export function horizonNdcY(elevation: number, fov: number = ARENA_FOV): number {
  return Math.tan(elevation) / tanHalfFov(fov);
}

/**
 * How far from the centre line a scripted move may carry the level. Under 1,
 * so the horizon is still a straight rule near the frame edge rather than a
 * swooping arc through the corners.
 */
export const MAX_HORIZON_NDC = 0.9;

/**
 * The elevation band a *composing* move may use. The old bound was 1.25 rad —
 * 72° — from which the horizon sits at NDC 7.8 and the world reads as a
 * tumbling wireframe. Bounding the level is why the attend now leaves some
 * beads above the centre line: a bead on the crown of the instrument cannot
 * be carried below centre without throwing the world's level away, and the
 * level is worth more than the corner.
 */
export const MAX_ELEVATION = Math.atan(MAX_HORIZON_NDC * tanHalfFov(ARENA_FOV));

/**
 * Half-height of the instrument that must never leave the frame: the outer
 * edge of the armillary's prime circle, with a little air. `Armillary.tsx`
 * strikes that circle at 1.21 arena radii and rolls it 0.07 wide, and its own
 * test holds it inside this.
 */
export const INSTRUMENT_HALF_SPAN = ARENA_RADIUS * 1.24;

/** Absolute ceiling on the aim offset, whatever the distance allows. */
const TARGET_OFFSET_CEILING = 1.6;

/**
 * How far the aim point may leave the arena's centre at a given distance:
 * exactly the room left over once the instrument has been fitted vertically.
 * It used to be a single constant tuned for one distance, which was either
 * timid when the camera stood back or a promise it could not keep when it
 * came close.
 */
export function maxTargetOffset(
  distance: number,
  fov: number = ARENA_FOV
): number {
  return clamp(
    distance * tanHalfFov(fov) - INSTRUMENT_HALF_SPAN,
    0,
    TARGET_OFFSET_CEILING
  );
}

/* ────────────────────────────────────────────────────────────────────── *
 * 4. THE ATTENDED POSTURE, SOLVED RATHER THAN NUDGED
 * ────────────────────────────────────────────────────────────────────── */

/**
 * I-012 asks for a situated, off-centre posture that still preserves the whole
 * spherical arena. Panning the target to shove the bead into a corner drags
 * the arena out of frame with it, so the instrument is *turned* instead: the
 * camera orbits to a position from which the attended bead falls where we
 * want it, while still aimed at the arena's centre.
 *
 * With no camera roll the camera's right vector is always horizontal, which
 * makes the azimuth a closed form. The elevation is bounded by the level
 * (§3) — the camera never flies to the pole to chase a bead that is already
 * overhead — so it is solved by search within that range, and whatever the
 * rotation could not deliver is absorbed by a bounded target offset.
 *
 * Finally the pose is checked against the safe area, and if the plate would
 * not fit the camera *stands back* until it does. Standing back is the only
 * honest remedy: cropping the plate is the defect this exists to prevent.
 */

export interface AttendedFramingRequest {
  /** World position of the attended bead. Must not be the arena's centre. */
  readonly bead: THREE.Vector3;
  /** Orbit distance the camera should hold. */
  readonly distance: number;
  /** Viewport aspect ratio. */
  readonly aspect: number;
  /** Where the bead should land, in NDC. Negative y is the lower half. */
  readonly ndcX: number;
  readonly ndcY: number;
  /** Vertical field of view in degrees. */
  readonly fov?: number;
  /** Box the bead's plate must fit inside. Omit to compose without one. */
  readonly safeArea?: SafeArea;
  /** How far back the camera may stand to make the plate fit. */
  readonly maxDistance?: number;
}

export interface AttendedFraming {
  /** Camera position, on the orbit sphere. */
  readonly position: THREE.Vector3;
  /** Aim point, within `maxTargetOffset` of the arena's centre. */
  readonly target: THREE.Vector3;
  /** Where the bead actually lands, in NDC. */
  readonly landed: { readonly x: number; readonly y: number };
  /** False when even the furthest allowed pose could not fit the plate. */
  readonly safe: boolean;
}

/**
 * The azimuth is solved against the frame measured at the *arena's* depth,
 * but the bead is nearer the camera than that, so the frame is narrower where
 * it actually sits and the first solve always lands the bead further out than
 * asked. The vertical solve has always corrected for this by measuring; the
 * horizontal one did not, and on a portrait viewport — where the frame is
 * narrow and the safe area correspondingly tight — that error was the
 * difference between the plate fitting and the plate hanging off the side.
 *
 * Four passes of the same measured correction, sharing the elevation and lift
 * solve underneath.
 */
function solvePose(
  bead: THREE.Vector3,
  distance: number,
  aspect: number,
  ndcX: number,
  ndcY: number,
  fov: number
): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  let asked = ndcX;
  let pose = solveOnce(bead, distance, aspect, asked, ndcY, fov);
  for (let pass = 0; pass < 7 && pose; pass++) {
    const landed = projectFromPose(bead, pose.position, pose.target, aspect, fov);
    const error = ndcX - landed.x;
    if (Math.abs(error) < 2e-4) break;
    asked = clamp(asked + error, -1.4, 1.4);
    pose = solveOnce(bead, distance, aspect, asked, ndcY, fov);
  }
  return pose;
}

function solveOnce(
  bead: THREE.Vector3,
  distance: number,
  aspect: number,
  ndcX: number,
  ndcY: number,
  fov: number
): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  const radius = bead.length();
  if (radius < 1e-4 || distance <= 0) return null;

  const ux = bead.x / radius;
  const uy = bead.y / radius;
  const uz = bead.z / radius;

  const halfH = distance * tanHalfFov(fov);
  const halfW = halfH * Math.max(aspect, 0.1);
  // The components of the unit bead direction along the camera's right and up.
  const wantRight = (ndcX * halfW) / radius;
  const wantUp = (ndcY * halfH) / radius;

  const rho = Math.hypot(ux, uz);
  if (rho < 1e-3) return null; // directly over a pole: no azimuth solves it

  // Azimuth: closed form. a = rho * sin(lambda - phi).
  const a = clamp(wantRight, -0.94 * rho, 0.94 * rho);
  const lambda = Math.atan2(ux, uz);
  const phi = lambda - Math.asin(a / rho);
  const q = Math.sqrt(Math.max(0, rho * rho - a * a));

  // Elevation: b(psi) = uy*cos(psi) - q*sin(psi), searched inside the level
  // bound rather than inverted, because the exact inverse regularly lies
  // outside it and a clamped inverse silently returns the wrong hemisphere.
  const b = (psi: number): number => uy * Math.cos(psi) - q * Math.sin(psi);
  let best = -MAX_ELEVATION;
  let bestError = Number.POSITIVE_INFINITY;
  const STEPS = 96;
  for (let i = 0; i <= STEPS; i++) {
    const psi = -MAX_ELEVATION + (2 * MAX_ELEVATION * i) / STEPS;
    const error = Math.abs(b(psi) - wantUp);
    if (error < bestError) {
      bestError = error;
      best = psi;
    }
  }
  // Refine around the winner; the function is smooth over this interval.
  const span = (2 * MAX_ELEVATION) / STEPS;
  let lo = Math.max(-MAX_ELEVATION, best - span);
  let hi = Math.min(MAX_ELEVATION, best + span);
  for (let i = 0; i < 24; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (Math.abs(b(m1) - wantUp) <= Math.abs(b(m2) - wantUp)) hi = m2;
    else lo = m1;
  }
  const psi = (lo + hi) / 2;

  const cosPsi = Math.cos(psi);
  const position = new THREE.Vector3(
    cosPsi * Math.sin(phi),
    Math.sin(psi),
    cosPsi * Math.cos(phi)
  ).multiplyScalar(distance);

  // Whatever the bounded rotation could not deliver, the aim point absorbs —
  // up to the limit that keeps the whole instrument in frame.
  //
  // Solved against the *real* projection rather than the linearised one: a
  // bead is nearer the camera than the arena's centre, so the frame is
  // narrower where it sits, and a lift computed at the centre's depth
  // consistently undershoots. Four passes converge well inside a pixel.
  const bound = maxTargetOffset(distance, fov);
  const up = cameraUp(position, ORIGIN_READONLY, new THREE.Vector3());
  const target = new THREE.Vector3();
  const viewDepth = distance - bead.dot(position.clone().normalize());
  const halfHAtBead = Math.max(0.1, viewDepth) * tanHalfFov(fov);
  let lift = 0;
  for (let i = 0; i < 4; i++) {
    target.copy(up).multiplyScalar(lift);
    const landed = projectFromPose(bead, position, target, aspect, fov);
    lift = clamp(lift + (landed.y - ndcY) * halfHAtBead, -bound, bound);
  }
  target.copy(up).multiplyScalar(lift);

  return { position, target };
}

/**
 * A camera pose from which `bead` lands as near as the level allows to
 * `(ndcX, ndcY)`, and — when a safe area is supplied — never outside it.
 * Returns `null` for a degenerate request (a bead at the arena's centre, or
 * directly over a pole, where no azimuth solves it) so the caller can fall
 * back rather than snap somewhere absurd.
 */
export function attendedFraming(
  request: AttendedFramingRequest
): AttendedFraming | null {
  const fov = request.fov ?? ARENA_FOV;
  const { bead, aspect, safeArea } = request;
  // Aim a hair inside the box, and judge the answer against the box itself:
  // a pose solved to land exactly on the boundary lands *just* over it as
  // often as it lands just under, and just over is a clipped plate.
  const wanted = safeArea
    ? clampToSafeArea(request.ndcX, request.ndcY, insetArea(safeArea, 3e-3))
    : { x: request.ndcX, y: request.ndcY };

  const ceiling = Math.max(request.distance, request.maxDistance ?? request.distance);
  let distance = request.distance;
  let solved: AttendedFraming | null = null;

  for (let pass = 0; pass < 4; pass++) {
    const pose = solvePose(bead, distance, aspect, wanted.x, wanted.y, fov);
    if (!pose) return null;
    const landed = projectFromPose(bead, pose.position, pose.target, aspect, fov);
    const safe = safeArea
      ? withinSafeArea(landed.x, landed.y, safeArea, 0)
      : true;
    solved = { position: pose.position, target: pose.target, landed, safe };
    if (safe || !safeArea || distance >= ceiling - 1e-3) break;

    // Standing back shrinks every screen offset in proportion, so the factor
    // that would have fitted the worst axis is the factor to stand back by.
    const grow = Math.max(
      overshoot(landed.x, safeArea.minX, safeArea.maxX),
      overshoot(landed.y, safeArea.minY, safeArea.maxY)
    );
    const next = clamp(distance * Math.max(grow, 1.02), distance, ceiling);
    if (next <= distance + 1e-3) break;
    distance = next;
  }
  return solved;
}

/** The same box, pulled in by `by` on every side, never past its centre. */
function insetArea(area: SafeArea, by: number): SafeArea {
  const midX = (area.minX + area.maxX) / 2;
  const midY = (area.minY + area.maxY) / 2;
  return {
    minX: Math.min(area.minX + by, midX),
    maxX: Math.max(area.maxX - by, midX),
    minY: Math.min(area.minY + by, midY),
    maxY: Math.max(area.maxY - by, midY),
  };
}

/** How much further out a landed coordinate is than its allowed bound. */
function overshoot(value: number, min: number, max: number): number {
  if (value > max && max > 1e-3) return value / max;
  if (value < min && min < -1e-3) return value / min;
  return 1;
}

const ORIGIN_READONLY = new THREE.Vector3(0, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3();
const xAxis = new THREE.Vector3();
const yAxis = new THREE.Vector3();
const offset = new THREE.Vector3();

/** The camera's up vector for a roll-free pose. */
export function cameraUp(
  cameraPosition: THREE.Vector3,
  target: THREE.Vector3,
  out: THREE.Vector3
): THREE.Vector3 {
  zAxis.copy(cameraPosition).sub(target).normalize();
  xAxis.copy(WORLD_UP).cross(zAxis).normalize();
  return out.copy(zAxis).cross(xAxis);
}

/**
 * Where a world point lands in NDC for a camera at `cameraPosition` looking at
 * `target` with no roll. Used by the tests to verify the solver, and cheap
 * enough that a caller may use it to sanity-check a pose.
 */
export function projectFromPose(
  point: THREE.Vector3,
  cameraPosition: THREE.Vector3,
  target: THREE.Vector3,
  aspect: number,
  fov: number = ARENA_FOV
): { x: number; y: number } {
  zAxis.copy(cameraPosition).sub(target).normalize();
  xAxis.copy(WORLD_UP).cross(zAxis).normalize();
  yAxis.copy(zAxis).cross(xAxis);
  offset.copy(point).sub(cameraPosition);
  const depth = -offset.dot(zAxis);
  const halfH = depth * tanHalfFov(fov);
  const halfW = halfH * aspect;
  return { x: offset.dot(xAxis) / halfW, y: offset.dot(yAxis) / halfH };
}

/* ────────────────────────────────────────────────────────────────────── *
 * 5. THE PHRASING
 * ────────────────────────────────────────────────────────────────────── */

/**
 * ONE TEMPO.
 *
 * Every scripted camera move used to carry its own hand-picked smoothing time
 * — 0.5, 0.8, 0.85, 0.9, 0.95, 1.0, 1.1, 1.3, 1.4 — which is nine motion
 * characters, not one. They are now named phrases, and every phrase is a whole
 * or half multiple of a single beat, so the moves are *related* to each other
 * the way the intervals of a scale are.
 *
 *   breath   ½   arming: a short inward breath, no re-framing
 *   lean     1   attending: the instrument turns toward an idea
 *   release  1   the same length, reversed: attention let go of
 *   square   1   the Lens: squaring up to a plane reading
 *   settle  1½   a phase arriving
 *   dwell   1½   a reveal: staying with what was found
 *   crown    2   the concluding rise. The one phrase that leaves the level
 *                behind, and it announces that by taking twice as long.
 */
export const CAMERA_BEAT_SECONDS = 0.7;

export type CameraPhrase =
  | "breath"
  | "lean"
  | "release"
  | "square"
  | "settle"
  | "dwell"
  | "crown";

const PHRASE_BEATS: Readonly<Record<CameraPhrase, number>> = Object.freeze({
  breath: 0.5,
  lean: 1,
  release: 1,
  square: 1,
  settle: 1.5,
  dwell: 1.5,
  crown: 2,
});

export function phraseSmoothTime(phrase: CameraPhrase): number {
  return CAMERA_BEAT_SECONDS * PHRASE_BEATS[phrase];
}

/** Every phrase, for tests that assert the language is closed. */
export const CAMERA_PHRASES = Object.freeze(
  Object.keys(PHRASE_BEATS) as CameraPhrase[]
);

/**
 * ORBIT COORDINATES.
 *
 * Damping a camera's Cartesian position drives it along a chord — straight
 * through the instrument — so the elevation changes fastest in the middle of
 * the move and the horizon whips. Damping distance, azimuth and elevation
 * makes every scripted move a *turn* of the instrument at a controlled rate,
 * which is what gives the camera one motion character instead of several.
 */
export interface OrbitPose {
  distance: number;
  azimuth: number;
  elevation: number;
}

export function createOrbitPose(): OrbitPose {
  return { distance: 0, azimuth: 0, elevation: 0 };
}

export function orbitFromPosition(
  position: THREE.Vector3,
  out: OrbitPose
): OrbitPose {
  const distance = position.length();
  out.distance = distance;
  out.azimuth = Math.atan2(position.x, position.z);
  out.elevation =
    distance < 1e-6 ? 0 : Math.asin(clamp(position.y / distance, -1, 1));
  return out;
}

export function positionFromOrbit(
  orbit: OrbitPose,
  out: THREE.Vector3
): THREE.Vector3 {
  const cos = Math.cos(orbit.elevation);
  return out
    .set(
      cos * Math.sin(orbit.azimuth),
      Math.sin(orbit.elevation),
      cos * Math.cos(orbit.azimuth)
    )
    .multiplyScalar(orbit.distance);
}

/** To (-PI, PI]. */
export function wrapAngle(radians: number): number {
  const wrapped = ((radians + Math.PI) % (Math.PI * 2) + Math.PI * 2) %
    (Math.PI * 2);
  return wrapped - Math.PI;
}

/**
 * A critically damped scalar, carrying its own velocity. This is the same
 * formulation `maath`'s `damp` uses, restated here so the phrasing can be
 * exercised without a renderer — the motion *character* of an orbit move and
 * a position move therefore stays identical.
 */
export interface Damped {
  value: number;
  velocity: number;
}

export function createDamped(value = 0): Damped {
  return { value, velocity: 0 };
}

export function dampScalar(
  state: Damped,
  goal: number,
  smoothTime: number,
  dt: number
): number {
  const time = Math.max(1e-4, smoothTime);
  const omega = 2 / time;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - goal;
  const temp = (state.velocity + omega * change) * dt;
  state.velocity = (state.velocity - omega * temp) * decay;
  let next = goal + (change + temp) * decay;
  // Never sail past the goal; an overshooting camera reads as a stumble.
  // `change < 0` means the goal was above us, so landing above it overshot.
  if (change < 0 === next > goal) {
    next = goal;
    state.velocity = 0;
  }
  state.value = next;
  return next;
}

/** The same damper on a circle: always the short way round. */
export function dampAngle(
  state: Damped,
  goal: number,
  smoothTime: number,
  dt: number
): number {
  const nearest = state.value + wrapAngle(goal - state.value);
  const next = dampScalar(state, nearest, smoothTime, dt);
  state.value = wrapAngle(next);
  return state.value;
}

export interface OrbitDamper {
  readonly distance: Damped;
  readonly azimuth: Damped;
  readonly elevation: Damped;
}

export function createOrbitDamper(): OrbitDamper {
  return {
    distance: createDamped(),
    azimuth: createDamped(),
    elevation: createDamped(),
  };
}

/**
 * Step the camera one frame along its orbit toward `goal`.
 *
 * The camera's *current* position is authoritative — the player's own orbit,
 * and the controls' damping, move it between frames — so the damper carries
 * only velocity. Writes through `out`; allocates nothing.
 */
export function dampOrbitToward(
  damper: OrbitDamper,
  current: THREE.Vector3,
  goal: OrbitPose,
  smoothTime: number,
  dt: number,
  scratch: OrbitPose,
  out: THREE.Vector3
): THREE.Vector3 {
  orbitFromPosition(current, scratch);
  damper.distance.value = scratch.distance;
  damper.azimuth.value = scratch.azimuth;
  damper.elevation.value = scratch.elevation;
  scratch.distance = dampScalar(damper.distance, goal.distance, smoothTime, dt);
  scratch.azimuth = dampAngle(damper.azimuth, goal.azimuth, smoothTime, dt);
  scratch.elevation = dampScalar(
    damper.elevation,
    goal.elevation,
    smoothTime,
    dt
  );
  return positionFromOrbit(scratch, out);
}
