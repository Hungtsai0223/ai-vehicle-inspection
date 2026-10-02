import type { CapturedFrame } from "../types/frame";
import { selectKeyFrames } from "./frame-selection";
export function releaseFramePreview(frame: CapturedFrame) {
  if (frame.previewUrl?.startsWith("blob:"))
    URL.revokeObjectURL(frame.previewUrl);
}
/** In-memory ownership boundary; future offline storage can implement this interface. */
export interface FrameStore {
  addFrame(frame: CapturedFrame): void;
  getFrames(): CapturedFrame[];
  getKeyFrames(): CapturedFrame[];
  retainKeyFrames(): CapturedFrame[];
  clear(): void;
}
export class MemoryFrameStore implements FrameStore {
  private frames: CapturedFrame[] = [];
  constructor(
    private readonly maximum = 80,
    private readonly release = releaseFramePreview,
  ) {}
  addFrame(frame: CapturedFrame) {
    const duplicate = this.frames.findIndex((item) => item.id === frame.id);
    if (duplicate >= 0) {
      if (this.frames[duplicate].previewUrl !== frame.previewUrl)
        this.release(this.frames[duplicate]);
      this.frames.splice(duplicate, 1);
    }
    this.frames.push(frame);
    if (this.frames.length > this.maximum) {
      // Evict an old frame from the most represented view, retaining earlier views.
      const counts = new Map<string, number>();
      for (const item of this.frames)
        counts.set(item.vehicleView, (counts.get(item.vehicleView) ?? 0) + 1);
      const view = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      const index = this.frames.findIndex((item) => item.vehicleView === view);
      this.release(this.frames.splice(index, 1)[0]);
    }
  }
  getFrames() {
    return [...this.frames];
  }
  getKeyFrames() {
    return selectKeyFrames(this.frames);
  }
  retainKeyFrames() {
    const selected = this.getKeyFrames();
    const retained = new Set(selected.map((frame) => frame.id));
    for (const frame of this.frames)
      if (!retained.has(frame.id)) this.release(frame);
    this.frames = selected;
    return this.getFrames();
  }
  clear() {
    this.frames.forEach(this.release);
    this.frames = [];
  }
}
