import {
  INPUT_MODALITIES,
  type GestureProfile,
  type InputModality,
} from "../../domain/events";
import {
  GestureProfileBuildError,
  type GestureProfileBuildErrorCode,
} from "./GestureProfileBuildError";

export interface NormalizedGestureSample {
  readonly atMs: number;
  readonly xViewport?: number;
  readonly yViewport?: number;
  readonly pressure?: number;
}

export interface BuildGestureProfileInput {
  readonly inputModality: InputModality;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly samples?: readonly NormalizedGestureSample[];
}

interface PathSegment {
  readonly dx: number;
  readonly dy: number;
  readonly length: number;
  readonly speed: number;
}

function fail(code: GestureProfileBuildErrorCode, message: string): never {
  throw new GestureProfileBuildError(code, message);
}

function isSupportedInputModality(value: unknown): value is InputModality {
  return (
    typeof value === "string" &&
    (INPUT_MODALITIES as readonly string[]).includes(value)
  );
}

function requireFiniteNonNegativeTime(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail("invalid-time-range", `${label} must be finite and non-negative`);
  }
  return value;
}

function requireSamples(
  value: readonly NormalizedGestureSample[] | undefined
): readonly NormalizedGestureSample[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    fail("invalid-samples", "gesture samples must be an array when supplied");
  }
  return value;
}

function calculateSegments(
  samples: readonly NormalizedGestureSample[]
): readonly PathSegment[] {
  const segments: PathSegment[] = [];

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const dx = current.xViewport! - previous.xViewport!;
    const dy = current.yViewport! - previous.yViewport!;
    const elapsedSeconds = (current.atMs - previous.atMs) / 1_000;
    const length = Math.hypot(dx, dy);
    const speed = length / elapsedSeconds;

    if (
      !Number.isFinite(dx) ||
      !Number.isFinite(dy) ||
      !Number.isFinite(length) ||
      !Number.isFinite(speed)
    ) {
      fail(
        "invalid-sample-coordinates",
        "gesture coordinates must produce finite path measurements"
      );
    }

    segments.push(Object.freeze({ dx, dy, length, speed }));
  }

  return segments;
}

function calculateCurvature(segments: readonly PathSegment[]): number {
  const movingSegments = segments.filter((segment) => segment.length > 0);
  if (movingSegments.length < 2) return 0;

  let normalizedAngleTotal = 0;
  for (let index = 1; index < movingSegments.length; index += 1) {
    const previous = movingSegments[index - 1];
    const current = movingSegments[index];
    const cosine =
      (previous.dx / previous.length) * (current.dx / current.length) +
      (previous.dy / previous.length) * (current.dy / current.length);
    const safeCosine = Math.max(-1, Math.min(1, cosine));
    normalizedAngleTotal += Math.acos(safeCosine) / Math.PI;
  }

  return normalizedAngleTotal / (movingSegments.length - 1);
}

function calculateGeometry(
  samples: readonly NormalizedGestureSample[]
): Pick<
  GestureProfile,
  | "pathLengthViewport"
  | "averageSpeedViewportPerSecond"
  | "speedVariance"
  | "curvature"
> {
  const segments = calculateSegments(samples);
  const pathLengthViewport = segments.reduce(
    (total, segment) => total + segment.length,
    0
  );
  const totalSegmentSeconds =
    (samples[samples.length - 1].atMs - samples[0].atMs) / 1_000;
  const averageSpeedViewportPerSecond =
    pathLengthViewport / totalSegmentSeconds;
  const meanSegmentSpeed =
    segments.reduce((total, segment) => total + segment.speed, 0) /
    segments.length;
  const speedVariance =
    segments.reduce((total, segment) => {
      const difference = segment.speed - meanSegmentSpeed;
      return total + difference * difference;
    }, 0) / segments.length;
  const curvature = calculateCurvature(segments);

  if (
    !Number.isFinite(pathLengthViewport) ||
    !Number.isFinite(averageSpeedViewportPerSecond) ||
    !Number.isFinite(meanSegmentSpeed) ||
    !Number.isFinite(speedVariance) ||
    !Number.isFinite(curvature)
  ) {
    fail(
      "invalid-sample-coordinates",
      "gesture coordinates must produce finite profile measurements"
    );
  }

  return {
    pathLengthViewport,
    curvature,
    averageSpeedViewportPerSecond,
    speedVariance,
  };
}

export function buildGestureProfile(
  input: BuildGestureProfileInput
): GestureProfile {
  if (!isSupportedInputModality(input?.inputModality)) {
    fail("unsupported-input-modality", "gesture input modality is not supported");
  }

  const startedAtMs = requireFiniteNonNegativeTime(
    input.startedAtMs,
    "gesture start time"
  );
  const endedAtMs = requireFiniteNonNegativeTime(
    input.endedAtMs,
    "gesture end time"
  );
  if (endedAtMs < startedAtMs) {
    fail("invalid-time-range", "gesture end time must not precede start time");
  }

  const samples = requireSamples(input.samples);
  let previousSampleTime: number | undefined;
  let coordinatesAvailable: boolean | undefined;
  let pressureTotal = 0;
  let pressureCount = 0;

  for (const sample of samples) {
    if (sample === null || typeof sample !== "object" || Array.isArray(sample)) {
      fail("invalid-samples", "every gesture sample must be an object");
    }

    if (
      typeof sample.atMs !== "number" ||
      !Number.isFinite(sample.atMs) ||
      sample.atMs < startedAtMs ||
      sample.atMs > endedAtMs
    ) {
      fail(
        "invalid-sample-time",
        "sample time must be finite and inside the gesture interval"
      );
    }
    if (previousSampleTime !== undefined && sample.atMs <= previousSampleTime) {
      fail("non-monotonic-samples", "sample times must be strictly increasing");
    }
    previousSampleTime = sample.atMs;

    const hasX = sample.xViewport !== undefined;
    const hasY = sample.yViewport !== undefined;
    if (hasX !== hasY) {
      fail(
        "invalid-sample-coordinates",
        "a sample must supply both viewport coordinates or neither"
      );
    }
    if (
      hasX &&
      (!Number.isFinite(sample.xViewport) || !Number.isFinite(sample.yViewport))
    ) {
      fail("invalid-sample-coordinates", "sample coordinates must be finite");
    }
    if (coordinatesAvailable === undefined) {
      coordinatesAvailable = hasX;
    } else if (coordinatesAvailable !== hasX) {
      fail(
        "mixed-coordinate-availability",
        "a gesture may not mix coordinate-bearing and coordinate-free samples"
      );
    }

    if (sample.pressure !== undefined) {
      if (
        typeof sample.pressure !== "number" ||
        !Number.isFinite(sample.pressure) ||
        sample.pressure < 0 ||
        sample.pressure > 1
      ) {
        fail("invalid-pressure", "sample pressure must be between 0 and 1");
      }
      pressureTotal += sample.pressure;
      pressureCount += 1;
    }
  }

  const geometry =
    coordinatesAvailable === true && samples.length >= 2
      ? calculateGeometry(samples)
      : {};
  const profile: GestureProfile = {
    inputModality: input.inputModality,
    durationMs: endedAtMs - startedAtMs,
    ...geometry,
    ...(pressureCount === 0 ? {} : { pressure: pressureTotal / pressureCount }),
  };

  return Object.freeze(profile);
}
