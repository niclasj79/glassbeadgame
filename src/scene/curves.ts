import * as THREE from "three";
import type { RelationIntention } from "@/domain/events";
import { threadForm } from "./threadGrammar";

/** Default bulge of a thread's arc midpoint beyond the armillary. */
const ARC_LIFT = 1.16;

/**
 * The lift of the unread strand — the preview a pair wears before anyone has
 * read it (I-016, I-017). It bows over the surface like every reading but
 * Ground, and deliberately matches none of the four exactly: the arc is one
 * of a reading's channels, and a strand that has not been read must not be
 * mistaken for one that has.
 */
export const NEUTRAL_ARC_LIFT = 1.12;

const vPerp = new THREE.Vector3();
const vNeutralMid = new THREE.Vector3();

/**
 * Arc midpoint pushed radially by `lift`; stable even for near-antipodal
 * pairs. A lift below 1 sends the arc *inside* the armillary, which is what
 * makes a Ground thread pass beneath the surface rather than over it.
 */
export function arcMid(
  start: THREE.Vector3,
  end: THREE.Vector3,
  out: THREE.Vector3,
  lift = ARC_LIFT
): THREE.Vector3 {
  out.copy(start).add(end).multiplyScalar(0.5);
  const targetLen = Math.max(start.length(), end.length()) * lift;
  if (out.lengthSq() < 0.2) {
    // Nearly antipodal: bulge sideways along a stable perpendicular.
    vPerp.copy(start).cross(end);
    if (vPerp.lengthSq() < 1e-4) vPerp.set(0, 1, 0);
    out.addScaledVector(vPerp.normalize(), 0.001).normalize().multiplyScalar(targetLen);
  } else {
    out.normalize().multiplyScalar(targetLen);
  }
  return out;
}

/**
 * The same arc, lifted by the intention's own form (see threadGrammar) — or,
 * for the unread strand (`null`), by the neutral lift.
 */
export function intentionArcMid(
  start: THREE.Vector3,
  end: THREE.Vector3,
  intention: RelationIntention | null,
  out: THREE.Vector3
): THREE.Vector3 {
  return arcMid(
    start,
    end,
    out,
    intention === null ? NEUTRAL_ARC_LIFT : threadForm(intention).arcLift
  );
}

/**
 * Quadratic Bézier — the one curve every ribbon is drawn along. The vertex
 * shader in `ribbon.ts` evaluates exactly this from the same three points, so
 * a voice light, a picking sample and a plate anchor all land on the strand
 * the player can see rather than on an approximation of it.
 */
export function arcPoint(
  a: THREE.Vector3,
  m: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const it = 1 - t;
  out.set(
    it * it * a.x + 2 * it * t * m.x + t * t * b.x,
    it * it * a.y + 2 * it * t * m.y + t * t * b.y,
    it * it * a.z + 2 * it * t * m.z + t * t * b.z
  );
  return out;
}

/**
 * Where the sigils bloom (I-016): halfway along the unread strand between the
 * locked pair.
 *
 * Deliberately the *unread* strand's midpoint and not the strand as currently
 * drawn. Hovering Ground drops the preview inside the armillary; if the plate
 * followed it, the sigil under the pointer would leave the pointer, the hover
 * would end, the strand would rise again, and the plate would chase its own
 * tail. The plate stands where the pair is, whatever reading is being heard.
 */
export function previewMidpoint(
  start: THREE.Vector3,
  end: THREE.Vector3,
  out: THREE.Vector3
): THREE.Vector3 {
  arcMid(start, end, vNeutralMid, NEUTRAL_ARC_LIFT);
  return arcPoint(start, vNeutralMid, end, 0.5, out);
}
