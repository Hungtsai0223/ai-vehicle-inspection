"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Camera } from "lucide-react";
import {
  CameraSession,
  cameraErrorState,
  cameraMessages,
} from "@/lib/camera-access";
import {
  captureCameraFrame,
  frameSamplingIntervalMs,
} from "@/lib/camera-frame-capture";
import { releaseFramePreview } from "@/lib/frame-store";
import type { CameraPermissionState } from "@/types/camera";
import type { CameraPreviewProps } from "./CameraPreview";
import { BoundingBox } from "./mock-camera-preview";
/** Mounted only after an explicit start action. No camera request on /scan entry. */
export function RealCameraPreview({
  scanActive,
  onFrameCapture,
  onCameraReady,
  onCameraStateChange,
  onCaptureError,
  onUseDemo,
  getCaptureMetadata,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [session] = useState(() => new CameraSession());
  const [permission, setPermission] =
    useState<CameraPermissionState>("loading");
  const notifyState = useEffectEvent((state: CameraPermissionState) =>
    onCameraStateChange?.(state),
  );
  const notifyReady = useEffectEvent(() => onCameraReady?.());
  const emitFrame = useEffectEvent(
    (frame: NonNullable<Awaited<ReturnType<typeof captureCameraFrame>>>) =>
      onFrameCapture?.(frame),
  );
  const capture = useEffectEvent(
    (canvas: HTMLCanvasElement, qualityCanvas: HTMLCanvasElement) => {
      const video = videoRef.current;
      return video
        ? captureCameraFrame(video, {
            ...(getCaptureMetadata?.() ?? {
              timestamp: 0,
              prototypeProgress: 0,
            }),
            canvas,
            qualityCanvas,
          })
        : Promise.resolve(null);
    },
  );
  const failCapture = useEffectEvent(() => {
    session.close();
    setPermission("camera_unavailable");
    notifyState("camera_unavailable");
    onCaptureError?.("影格擷取暫時失敗，請重新開始掃描，或改用 Demo 模式。");
  });
  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    const tracks: MediaStreamTrack[] = [];
    let interruption: ReturnType<typeof setTimeout> | undefined;
    const pause = () => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(interruption);
      session.close();
      if (video) video.srcObject = null;
      setPermission("paused");
      notifyState("paused");
    };
    const interrupted = () => {
      clearTimeout(interruption);
      interruption = setTimeout(pause, 1500);
    };
    const resumed = () => clearTimeout(interruption);
    video?.addEventListener("error", pause);
    const visibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pause);
    notifyState("loading");
    if (document.hidden) pause();
    else
      void session
        .open()
        .then(async (stream) => {
          if (cancelled || !video) return;
          video.srcObject = stream;
          for (const track of stream.getTracks()) {
            tracks.push(track);
            track.addEventListener("ended", pause);
            track.addEventListener("mute", interrupted);
            track.addEventListener("unmute", resumed);
          }
          await video.play();
          if (cancelled) return;
          setPermission("permission_granted");
          notifyState("permission_granted");
          notifyReady();
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          session.close();
          const state = cameraErrorState(error);
          setPermission(state);
          notifyState(state);
        });
    return () => {
      cancelled = true;
      session.close();
      if (video) video.srcObject = null;
      clearTimeout(interruption);
      video?.removeEventListener("error", pause);
      tracks.forEach((track) => {
        track.removeEventListener("ended", pause);
        track.removeEventListener("mute", interrupted);
        track.removeEventListener("unmute", resumed);
      });
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pause);
    };
  }, [session]);
  useEffect(() => {
    if (!scanActive || permission !== "permission_granted") return;
    let cancelled = false;
    let busy = false;
    const canvas = document.createElement("canvas");
    const qualityCanvas = document.createElement("canvas");
    const sample = async () => {
      if (busy || cancelled || document.hidden) return;
      busy = true;
      try {
        const frame = await capture(canvas, qualityCanvas);
        if (frame) {
          if (cancelled) releaseFramePreview(frame);
          else emitFrame(frame);
        }
      } catch {
        if (!cancelled) failCapture();
      } finally {
        busy = false;
      }
    };
    void sample();
    const timer = setInterval(() => void sample(), frameSamplingIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
      canvas.width =
        canvas.height =
        qualityCanvas.width =
        qualityCanvas.height =
          0;
    };
  }, [scanActive, permission]);
  return (
    <div className="camera-preview real-camera-preview">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="即時相機畫面"
      />
      <span className="camera-label">
        <Camera size={14} />
        {permission === "permission_granted"
          ? "即時相機 · 僅擷取本次檢查影格"
          : "真實相機"}
      </span>
      <BoundingBox good={false} />
      {permission !== "permission_granted" && (
        <div
          className="camera-access-message"
          role={permission === "loading" ? "status" : "alert"}
        >
          <p>{cameraMessages[permission]}</p>
          <button type="button" onClick={onUseDemo}>
            改用 Demo 模式
          </button>
        </div>
      )}
    </div>
  );
}
