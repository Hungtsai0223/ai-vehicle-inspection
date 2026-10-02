"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle } from "lucide-react";
import { partLabels } from "@/lib/inspection-labels";
import { mockConfig } from "@/lib/mock-data";
import type { DamageDetection } from "@/types/inspection";
import { VehicleDamageMap } from "@/components/vehicle/vehicle-damage-map";
import { Button } from "@/components/ui/primitives";
export function RecaptureDialog({
  damage,
  onComplete,
  onDismiss,
}: {
  damage: DamageDetection;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [captured, setCaptured] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const capture = setTimeout(
      () => setCaptured(true),
      mockConfig.recaptureTargetMs,
    );
    const next = setTimeout(
      onComplete,
      mockConfig.recaptureTargetMs + mockConfig.recaptureCompleteMs,
    );
    return () => {
      clearTimeout(capture);
      clearTimeout(next);
      dialog?.close();
    };
  }, [onComplete]);
  return (
    <dialog
      ref={ref}
      className="recapture-dialog"
      aria-labelledby="recapture-title"
      aria-describedby="recapture-description"
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
    >
      <div className={captured ? "capture-success" : "capture-icon"}>
        {captured ? <CheckCircle size={32} /> : <Camera size={32} />}
      </div>
      <h2 id="recapture-title">
        {captured ? "補拍完成" : `請對準${partLabels[damage.part].zh}`}
      </h2>
      <VehicleDamageMap
        vehicleParts={[damage.part]}
        damageLocations={[damage]}
      />
      <p id="recapture-description" role="status">
        {captured
          ? "模擬影像已加入報告，即將顯示結果。"
          : "正在模擬補拍，不會開啟攝影機。"}
      </p>
      <Button className="secondary" onClick={onDismiss}>
        取消補拍
      </Button>
    </dialog>
  );
}
