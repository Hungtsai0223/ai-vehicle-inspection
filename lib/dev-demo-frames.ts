import type { CapturedFrame } from "../types/frame";
/** Only the local development HTTP stub accepts generated DEMO image bytes. */
export function isDevelopmentStub(
  baseUrl = process.env.NEXT_PUBLIC_AI_API_URL ?? "",
) {
  return (
    process.env.NODE_ENV === "development" &&
    /\/api\/dev\/?(?:\?|$)/.test(baseUrl)
  );
}
export async function materializeDemoFrames(
  frames: CapturedFrame[],
): Promise<CapturedFrame[]> {
  if (!isDevelopmentStub()) return frames;
  const image = new Image();
  image.src = "/mock/after.svg";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Demo image unavailable"));
  });
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const result: CapturedFrame[] = [];
  try {
    for (const frame of frames) {
      context.drawImage(image, 0, 0, 640, 360);
      context.fillStyle = "#202633";
      context.fillRect(0, 320, 640, 40);
      context.fillStyle = "#ffffff";
      context.font = "16px sans-serif";
      context.fillText(
        `DEMO fixture · ${frame.id} · ${frame.vehicleView}`,
        16,
        346,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("JPEG unavailable"))),
          "image/jpeg",
          0.8,
        ),
      );
      result.push({ ...frame, blob, previewUrl: URL.createObjectURL(blob) });
    }
    return result;
  } catch (error) {
    result.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    throw error;
  }
}
