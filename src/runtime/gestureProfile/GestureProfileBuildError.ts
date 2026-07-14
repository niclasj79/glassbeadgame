export const GESTURE_PROFILE_BUILD_ERROR_CODES = Object.freeze([
  "unsupported-input-modality",
  "invalid-time-range",
  "invalid-samples",
  "invalid-sample-time",
  "non-monotonic-samples",
  "invalid-sample-coordinates",
  "mixed-coordinate-availability",
  "invalid-pressure",
] as const);

export type GestureProfileBuildErrorCode =
  (typeof GESTURE_PROFILE_BUILD_ERROR_CODES)[number];

export class GestureProfileBuildError extends Error {
  readonly code: GestureProfileBuildErrorCode;

  constructor(code: GestureProfileBuildErrorCode, message: string) {
    super(message);
    this.name = "GestureProfileBuildError";
    this.code = code;
  }
}
