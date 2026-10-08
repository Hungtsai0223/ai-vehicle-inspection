/** Browser capabilities vary even between cameras on one device. No user-agent assumptions. */
export const LIGHT_THRESHOLDS = {
  low: 0.18,
  bright: 0.35,
  lowHoldMs: 1500,
  brightHoldMs: 2000,
  cooldownMs: 2500,
} as const;
export class LowLightDetector {
  private since: number | undefined;
  private direction: "low" | "bright" | undefined;
  lowLightDetected = false;
  observe(brightness: number | undefined, now: number): boolean {
    const direction =
      brightness !== undefined && Number.isFinite(brightness)
        ? brightness < LIGHT_THRESHOLDS.low
          ? "low"
          : brightness > LIGHT_THRESHOLDS.bright
            ? "bright"
            : undefined
        : undefined;
    if (!direction) {
      this.since = undefined;
      this.direction = undefined;
      return this.lowLightDetected;
    }
    if (this.direction !== direction) {
      this.since = now;
      this.direction = direction;
    }
    const elapsed = now - (this.since ?? now);
    if (direction === "low" && elapsed >= LIGHT_THRESHOLDS.lowHoldMs)
      this.lowLightDetected = true;
    if (direction === "bright" && elapsed >= LIGHT_THRESHOLDS.brightHoldMs)
      this.lowLightDetected = false;
    return this.lowLightDetected;
  }
}
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraint = MediaTrackConstraintSet & { torch: boolean };
export type TorchMode = "auto" | "on" | "off";
export interface TorchState {
  torchSupported: boolean;
  torchEnabled: boolean;
  autoTorchEnabled: boolean;
  lowLightDetected: boolean;
  mode: TorchMode;
  failed: boolean;
}
export function supportsTorch(track: MediaStreamTrack): boolean {
  try {
    return (
      track.kind === "video" &&
      track.readyState === "live" &&
      typeof track.applyConstraints === "function" &&
      typeof track.getCapabilities === "function" &&
      (track.getCapabilities() as TorchCapabilities).torch === true
    );
  } catch {
    return false;
  }
}
export class CameraTorchController {
  private detector = new LowLightDetector();
  private closed = false;
  private busy = false;
  private manualPending = false;
  private queue: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastAttempt = -Infinity;
  private failedTarget: boolean | undefined;
  state: TorchState;
  constructor(
    private track: MediaStreamTrack,
    private onChange: (state: TorchState) => void = () => {},
    private now = () => performance.now(),
  ) {
    this.state = {
      torchSupported: supportsTorch(track),
      torchEnabled: false,
      autoTorchEnabled: true,
      lowLightDetected: false,
      mode: "auto",
      failed: false,
    };
    this.publish();
  }
  private publish() {
    if (!this.closed) this.onChange({ ...this.state });
  }
  observe(brightness: number | undefined, now = this.now()) {
    if (this.closed) return;
    const low = this.detector.observe(brightness, now);
    if (low !== this.state.lowLightDetected) {
      this.state.lowLightDetected = low;
      this.publish();
      this.reconcile(this.manualPending);
    }
  }
  setMode(mode: TorchMode) {
    if (this.closed) return;
    this.manualPending = true;
    this.state.mode = mode;
    this.state.autoTorchEnabled = mode === "auto";
    this.failedTarget = undefined;
    this.publish();
    this.reconcile(true);
  }
  private reconcile(manual = false) {
    clearTimeout(this.timer);
    if (this.closed || this.busy || !this.state.torchSupported) return;
    const target =
      this.state.mode === "on" ||
      (this.state.mode === "auto" && this.state.lowLightDetected);
    if (
      target === this.state.torchEnabled ||
      (!manual && target === this.failedTarget)
    )
      return;
    const delay = manual
      ? 0
      : LIGHT_THRESHOLDS.cooldownMs - (this.now() - this.lastAttempt);
    if (delay > 0) {
      this.timer = setTimeout(() => this.reconcile(), delay);
      return;
    }
    this.manualPending = false;
    this.busy = true;
    this.lastAttempt = this.now();
    this.queue = this.queue.then(async () => {
      if (this.closed) return;
      try {
        await this.track.applyConstraints({
          advanced: [{ torch: target } as TorchConstraint],
        });
        this.state.torchEnabled = target;
        this.state.failed = false;
        this.failedTarget = undefined;
      } catch {
        this.state.failed = true;
        this.failedTarget = target;
      }
      this.busy = false;
      this.publish();
      this.reconcile(this.manualPending);
    });
  }
  /** Serializes OFF after any in-flight ON; stopping the track also extinguishes hardware. */
  dispose(): Promise<void> {
    this.closed = true;
    clearTimeout(this.timer);
    this.queue = this.queue.then(async () => {
      if (this.state.torchSupported) {
        try {
          await this.track.applyConstraints({
            advanced: [{ torch: false } as TorchConstraint],
          });
        } catch {
          /* Ended tracks may reject. */
        }
      }
      this.state.torchEnabled = false;
    });
    return this.queue;
  }
  settled() {
    return this.queue;
  }
}
