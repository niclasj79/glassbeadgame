import { describe, expect, it } from "vitest";
import type { InputModality } from "../../domain/events";
import {
  GESTURE_PROFILE_BUILD_ERROR_CODES,
  GestureProfileBuildError,
  buildGestureProfile,
  type BuildGestureProfileInput,
} from ".";

function unsafeInput(value: unknown): BuildGestureProfileInput {
  return value as BuildGestureProfileInput;
}

function expectBuildError(
  input: BuildGestureProfileInput,
  code: (typeof GESTURE_PROFILE_BUILD_ERROR_CODES)[number]
): void {
  expect(() => buildGestureProfile(input)).toThrowError(
    expect.objectContaining({ name: "GestureProfileBuildError", code })
  );
}

describe("buildGestureProfile", () => {
  it("exports a closed frozen error vocabulary", () => {
    expect(GESTURE_PROFILE_BUILD_ERROR_CODES).toEqual([
      "unsupported-input-modality",
      "invalid-time-range",
      "invalid-samples",
      "invalid-sample-time",
      "non-monotonic-samples",
      "invalid-sample-coordinates",
      "mixed-coordinate-availability",
      "invalid-pressure",
    ]);
    expect(Object.isFrozen(GESTURE_PROFILE_BUILD_ERROR_CODES)).toBe(true);

    const error = new GestureProfileBuildError(
      "invalid-pressure",
      "invalid pressure"
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GestureProfileBuildError");
    expect(error.code).toBe("invalid-pressure");
  });

  it.each(["keyboard", "controller"] as const)(
    "builds an honest %s hold-only profile without fabricated geometry",
    (inputModality) => {
      expect(
        buildGestureProfile({ inputModality, startedAtMs: 100, endedAtMs: 725 })
      ).toEqual({ inputModality, durationMs: 625 });
    }
  );

  it("allows a zero-duration hold and coordinate-free pressure samples", () => {
    expect(
      buildGestureProfile({
        inputModality: "controller",
        startedAtMs: 50,
        endedAtMs: 50,
        samples: [{ atMs: 50, pressure: 0.4 }],
      })
    ).toEqual({ inputModality: "controller", durationMs: 0, pressure: 0.4 });
  });

  it.each(["mouse", "touch", "pen"] as const)(
    "builds normalized geometry for %s input",
    (inputModality) => {
      expect(
        buildGestureProfile({
          inputModality,
          startedAtMs: 0,
          endedAtMs: 1_000,
          samples: [
            { atMs: 0, xViewport: 0, yViewport: 0 },
            { atMs: 1_000, xViewport: 3, yViewport: 4 },
          ],
        })
      ).toEqual({
        inputModality,
        durationMs: 1_000,
        pathLengthViewport: 5,
        curvature: 0,
        averageSpeedViewportPerSecond: 5,
        speedVariance: 0,
      });
    }
  );

  it("calculates turns, unequal segment speed variance, and supplied pressure", () => {
    expect(
      buildGestureProfile({
        inputModality: "pen",
        startedAtMs: 0,
        endedAtMs: 1_500,
        samples: [
          { atMs: 0, xViewport: 0, yViewport: 0, pressure: 0 },
          { atMs: 1_000, xViewport: 1, yViewport: 0 },
          { atMs: 1_500, xViewport: 1, yViewport: 2, pressure: 1 },
        ],
      })
    ).toEqual({
      inputModality: "pen",
      durationMs: 1_500,
      pathLengthViewport: 3,
      curvature: 0.5,
      averageSpeedViewportPerSecond: 2,
      speedVariance: 2.25,
      pressure: 0.5,
    });
  });

  it("skips stationary segments when averaging curvature", () => {
    const result = buildGestureProfile({
      inputModality: "mouse",
      startedAtMs: 0,
      endedAtMs: 3_000,
      samples: [
        { atMs: 0, xViewport: 0, yViewport: 0 },
        { atMs: 1_000, xViewport: 1, yViewport: 0 },
        { atMs: 2_000, xViewport: 1, yViewport: 0 },
        { atMs: 3_000, xViewport: 1, yViewport: 1 },
      ],
    });

    expect(result.pathLengthViewport).toBe(2);
    expect(result.curvature).toBe(0.5);
    expect(result.averageSpeedViewportPerSecond).toBeCloseTo(2 / 3);
    expect(result.speedVariance).toBeCloseTo(2 / 9);
  });

  it("returns zero geometry for a stationary path", () => {
    expect(
      buildGestureProfile({
        inputModality: "touch",
        startedAtMs: 0,
        endedAtMs: 500,
        samples: [
          { atMs: 100, xViewport: 0.25, yViewport: 0.75 },
          { atMs: 300, xViewport: 0.25, yViewport: 0.75 },
        ],
      })
    ).toMatchObject({
      pathLengthViewport: 0,
      curvature: 0,
      averageSpeedViewportPerSecond: 0,
      speedVariance: 0,
    });
  });

  it("omits geometry for no samples, coordinate-free samples, or one point", () => {
    const cases: BuildGestureProfileInput[] = [
      { inputModality: "unknown", startedAtMs: 0, endedAtMs: 10, samples: [] },
      {
        inputModality: "keyboard",
        startedAtMs: 0,
        endedAtMs: 10,
        samples: [{ atMs: 5 }],
      },
      {
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 10,
        samples: [{ atMs: 5, xViewport: 0, yViewport: 0 }],
      },
    ];

    for (const input of cases) {
      const result = buildGestureProfile(input);
      expect(result).not.toHaveProperty("pathLengthViewport");
      expect(result).not.toHaveProperty("curvature");
      expect(result).not.toHaveProperty("averageSpeedViewportPerSecond");
      expect(result).not.toHaveProperty("speedVariance");
    }
  });

  it("accepts finite coordinates outside the viewport without clamping", () => {
    const input: BuildGestureProfileInput = {
      inputModality: "mouse",
      startedAtMs: 0,
      endedAtMs: 1_000,
      samples: [
        { atMs: 0, xViewport: -1, yViewport: 0.5 },
        { atMs: 1_000, xViewport: 2, yViewport: 0.5 },
      ],
    };

    expect(buildGestureProfile(input).pathLengthViewport).toBe(3);
  });

  it("does not mutate input and returns a frozen byte-deterministic profile", () => {
    const input: BuildGestureProfileInput = {
      inputModality: "pen",
      startedAtMs: 10,
      endedAtMs: 510,
      samples: [
        { atMs: 10, xViewport: 0, yViewport: 0, pressure: 0.25 },
        { atMs: 510, xViewport: 0.5, yViewport: 0, pressure: 0.75 },
      ],
    };
    const snapshot = structuredClone(input);
    const first = buildGestureProfile(input);
    const second = buildGestureProfile(input);

    expect(input).toEqual(snapshot);
    expect(Object.isFrozen(first)).toBe(true);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it.each([
    { startedAtMs: -1, endedAtMs: 0 },
    { startedAtMs: 0, endedAtMs: -1 },
    { startedAtMs: 2, endedAtMs: 1 },
    { startedAtMs: Number.NaN, endedAtMs: 1 },
    { startedAtMs: 0, endedAtMs: Number.POSITIVE_INFINITY },
  ])("rejects an invalid gesture interval %#", ({ startedAtMs, endedAtMs }) => {
    expectBuildError(
      { inputModality: "mouse", startedAtMs, endedAtMs },
      "invalid-time-range"
    );
  });

  it("rejects unsupported modality and a non-array sample collection", () => {
    expectBuildError(
      {
        inputModality: "voice" as InputModality,
        startedAtMs: 0,
        endedAtMs: 1,
      },
      "unsupported-input-modality"
    );
    expectBuildError(
      unsafeInput({
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 1,
        samples: {},
      }),
      "invalid-samples"
    );
    expectBuildError(
      unsafeInput({
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 1,
        samples: [null],
      }),
      "invalid-samples"
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 11])(
    "rejects invalid sample time %s",
    (atMs) => {
      expectBuildError(
        {
          inputModality: "mouse",
          startedAtMs: 0,
          endedAtMs: 10,
          samples: [{ atMs }],
        },
        "invalid-sample-time"
      );
    }
  );

  it.each([
    [1, 1],
    [2, 1],
  ])("rejects non-monotonic sample times %s then %s", (first, second) => {
    expectBuildError(
      {
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 2,
        samples: [{ atMs: first }, { atMs: second }],
      },
      "non-monotonic-samples"
    );
  });

  it.each([
    { atMs: 0, xViewport: 0 },
    { atMs: 0, yViewport: 0 },
    { atMs: 0, xViewport: Number.NaN, yViewport: 0 },
    { atMs: 0, xViewport: 0, yViewport: Number.POSITIVE_INFINITY },
  ])("rejects invalid coordinate sample %#", (sample) => {
    expectBuildError(
      {
        inputModality: "mouse",
        startedAtMs: 0,
        endedAtMs: 1,
        samples: [sample],
      },
      "invalid-sample-coordinates"
    );
  });

  it("rejects mixed coordinate availability", () => {
    expectBuildError(
      {
        inputModality: "keyboard",
        startedAtMs: 0,
        endedAtMs: 1,
        samples: [
          { atMs: 0 },
          { atMs: 1, xViewport: 0, yViewport: 0 },
        ],
      },
      "mixed-coordinate-availability"
    );
  });

  it.each([-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid pressure %s",
    (pressure) => {
      expectBuildError(
        {
          inputModality: "pen",
          startedAtMs: 0,
          endedAtMs: 1,
          samples: [{ atMs: 0, pressure }],
        },
        "invalid-pressure"
      );
    }
  );
});
