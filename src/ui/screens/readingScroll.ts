/**
 * WHETHER THERE IS MORE TO READ.
 *
 * The conclusion is the last image the Game leaves, and on a 1440x810 desktop
 * it did not fit: the final readings were cut mid-heading at the viewport edge
 * with nothing on screen to say the page continued. A hairline scrollbar that
 * only appears while the wheel is moving — and on an overlay-scrollbar platform
 * does not appear at all — is not an affordance.
 *
 * The arithmetic is pulled out here so the rule is one testable function rather
 * than a comparison written inline in a scroll handler. It answers only what is
 * true of the geometry; what the page draws about it belongs to the component.
 */
export interface ScrollGeometry {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

export interface ScrollAffordance {
  /** There is text above the top edge. */
  readonly above: boolean;
  /** There is text below the bottom edge. */
  readonly below: boolean;
}

/**
 * Sub-pixel layout rounding routinely leaves a fraction of a pixel of "overflow"
 * on a panel that plainly fits, and a cue that says "there is more below" when
 * there is not is worse than no cue at all — it sends the reader looking for
 * something that does not exist. One line of leading is the threshold: below
 * that, nothing is hidden that anyone could read.
 */
const EPSILON = 12;

export function scrollAffordance(geometry: ScrollGeometry): ScrollAffordance {
  const hidden =
    geometry.scrollHeight - geometry.clientHeight - geometry.scrollTop;
  return {
    above: geometry.scrollTop > EPSILON,
    below: hidden > EPSILON,
  };
}
