import {
  createCalibrationSampler,
  addSample,
  finalizeCalibration,
  applyCalibrationToConfig,
  NEUTRAL_CALIB_MAX_SIGMA,
} from "@/lib/attention/neutralCalibration";
import { DEFAULT_CONFIG, type RawSignals } from "@/lib/attention/classify";

function signals(overrides: Partial<RawSignals> = {}): RawSignals {
  return {
    roll: 0,
    yaw: 0,
    pitch: 0,
    ear: 0.28,
    gazeX: 0,
    gazeY: 0,
    eyesClosed: false,
    ...overrides,
  };
}

describe("neutral-pose calibration sampler", () => {
  it("succeeds with a tight mean/sigma when every sample is identical (perfectly still)", () => {
    let sampler = createCalibrationSampler();
    for (let i = 0; i < 30; i++) {
      sampler = addSample(sampler, signals({ yaw: 0.02, pitch: -0.05, gazeX: 0.01, gazeY: 0.03 }));
    }
    const result = finalizeCalibration(sampler, 1000);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.calibration.yaw0).toBeCloseTo(0.02, 10);
      expect(result.calibration.pitch0).toBeCloseTo(-0.05, 10);
      expect(result.calibration.gazeX0).toBeCloseTo(0.01, 10);
      expect(result.calibration.gazeY0).toBeCloseTo(0.03, 10);
      expect(result.calibration.sigmas.yaw).toBeCloseTo(0, 10);
      expect(result.calibration.calibratedAtMs).toBe(1000);
    }
  });

  it("retries when the person moved too much during the window (sigma too large)", () => {
    let sampler = createCalibrationSampler();
    // Alternate between two very different yaw readings — well beyond
    // NEUTRAL_CALIB_MAX_SIGMA no matter how the threshold is tuned later.
    for (let i = 0; i < 30; i++) {
      sampler = addSample(sampler, signals({ yaw: i % 2 === 0 ? -0.5 : 0.5 }));
    }
    const result = finalizeCalibration(sampler, 1000);
    expect(result.status).toBe("retry");
  });

  it("retries when too few samples were collected", () => {
    let sampler = createCalibrationSampler();
    for (let i = 0; i < 3; i++) {
      sampler = addSample(sampler, signals());
    }
    const result = finalizeCalibration(sampler, 1000);
    expect(result.status).toBe("retry");
  });

  it("does not let a blink mid-capture drag gazeX/Y toward the eyesClosed placeholder", () => {
    let openOnly = createCalibrationSampler();
    let withBlinks = createCalibrationSampler();
    for (let i = 0; i < 30; i++) {
      openOnly = addSample(openOnly, signals({ gazeX: 0.1, gazeY: -0.1 }));
      const isBlink = i === 10 || i === 11;
      withBlinks = addSample(
        withBlinks,
        isBlink
          ? signals({ gazeX: 0.1, gazeY: -0.1, eyesClosed: true })
          : signals({ gazeX: 0.1, gazeY: -0.1 })
      );
    }
    const a = finalizeCalibration(openOnly, 1000);
    const b = finalizeCalibration(withBlinks, 1000);
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    if (a.status === "ok" && b.status === "ok") {
      expect(b.calibration.gazeX0).toBeCloseTo(a.calibration.gazeX0, 10);
      expect(b.calibration.gazeY0).toBeCloseTo(a.calibration.gazeY0, 10);
    }
  });

  it("a sigma comfortably under the threshold succeeds", () => {
    // Two symmetric values around 0 whose population stddev is well under
    // NEUTRAL_CALIB_MAX_SIGMA (stddev of {-s, +s} repeated is s itself).
    let sampler = createCalibrationSampler();
    const s = NEUTRAL_CALIB_MAX_SIGMA / 2;
    for (let i = 0; i < 30; i++) {
      sampler = addSample(sampler, signals({ yaw: i % 2 === 0 ? -s : s }));
    }
    const result = finalizeCalibration(sampler, 1000);
    expect(result.status).toBe("ok");
  });
});

describe("applyCalibrationToConfig", () => {
  it("returns the config unchanged when calibration is null", () => {
    const result = applyCalibrationToConfig(DEFAULT_CONFIG, null);
    expect(result).toBe(DEFAULT_CONFIG);
  });

  it("overwrites only the neutral* fields when a calibration is supplied", () => {
    const calibration = {
      yaw0: 0.1,
      pitch0: -0.2,
      gazeX0: 0.05,
      gazeY0: -0.05,
      ear0: 0.3,
      sigmas: { yaw: 0, pitch: 0, gazeX: 0, gazeY: 0 },
      calibratedAtMs: 12345,
    };
    const result = applyCalibrationToConfig(DEFAULT_CONFIG, calibration);
    expect(result.neutralYaw).toBe(0.1);
    expect(result.neutralPitch).toBe(-0.2);
    expect(result.neutralGazeX).toBe(0.05);
    expect(result.neutralGazeY).toBe(-0.05);
    // Everything else carried over unchanged.
    expect(result.msToDistract).toBe(DEFAULT_CONFIG.msToDistract);
    expect(result.gazeWeightK).toBe(DEFAULT_CONFIG.gazeWeightK);
  });
});
