import * as THREE from "three";

/** How far a thread's arc midpoint bulges beyond the sphere. */
const ARC_LIFT = 1.16;

const vPerp = new THREE.Vector3();

/** Arc midpoint pushed radially outward; stable even for near-antipodal pairs. */
export function arcMid(
  start: THREE.Vector3,
  end: THREE.Vector3,
  out: THREE.Vector3
): THREE.Vector3 {
  out.copy(start).add(end).multiplyScalar(0.5);
  const targetLen = Math.max(start.length(), end.length()) * ARC_LIFT;
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
