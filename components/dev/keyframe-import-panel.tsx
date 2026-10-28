"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { importKeyframes, KEYFRAME_IMPORT_LIMITS } from "@/lib/keyframe-import";
import { HttpInspectionApi } from "@/services/http-inspection-api";
import { pollInspection } from "@/services/poll-inspection";
import { inspectionErrorMessage } from "@/services/inspection-service";
import { getApiBaseUrl } from "@/lib/api-config";
import { useInspection } from "@/components/inspection/inspection-context";
import type { InspectionResult } from "@/types/inspection";
import type { CapturedFrame } from "@/types/frame";
export function KeyframeImportPanel({
  disabled,
  onBusyChange,
  onResult,
}: {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onResult: (result: InspectionResult) => void;
}) {
  const ctx = useInspection();
  const [metadata, setMetadata] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const metadataInput = useRef<HTMLInputElement>(null);
  const imagesInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const running = useRef(false);
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
      controller.current?.abort();
    },
    [],
  );
  function changed() {
    revision.current++;
    setFrames([]);
    setMessage("");
  }
  async function validate() {
    if (disabled || running.current || !metadata) return;
    const token = ++revision.current;
    setFrames([]);
    setMessage("");
    try {
      if (metadata.size > KEYFRAME_IMPORT_LIMITS.metadataBytes)
        throw new Error("metadata.json 超過 2 MiB，請減少影片候選數。");
      const parsed = JSON.parse(await metadata.text());
      if (token !== revision.current) return;
      const imported = importKeyframes(parsed, images);
      setFrames(imported);
      setMessage(
        `已驗證 ${imported.length} 張原始影格；時間已轉為毫秒，角度保持 unknown，尚未送出。`,
      );
    } catch (error) {
      if (token === revision.current)
        setMessage(
          error instanceof Error ? error.message : "無法讀取影格資料。",
        );
    }
  }
  async function upload() {
    if (disabled || running.current || !frames.length) return;
    running.current = true;
    setBusy(true);
    onBusyChange(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const api = new HttpInspectionApi(getApiBaseUrl());
      const session = await api.createInspection(
        { vehicle: ctx.vehicle },
        { signal: abort.signal },
      );
      setMessage(`正在上傳 ${frames.length} 張影格…`);
      await api.uploadInspectionFrames(session.inspectionId, frames, {
        signal: abort.signal,
      });
      await api.completeInspection(session.inspectionId, {
        signal: abort.signal,
      });
      const result = await pollInspection(
        api,
        session.inspectionId,
        (status) => setMessage(`分析進度 ${Math.round(status.progress)}%`),
        { signal: abort.signal, vehicle: ctx.vehicle },
      );
      if (abort.signal.aborted) return;
      if (ctx.mode === "API") ctx.acceptCompletedResult(result);
      onResult(result);
      setMessage(
        `HTTP 流程成功：${result.keyFrameCount} 張關鍵影格。${ctx.mode === "API" ? "結果已接入下方檢測結果。" : "目前使用開發 stub／Mock 頁面，結果僅供介面驗證，不代表已執行車損 AI。"}`,
      );
      setFrames([]);
      setImages([]);
      setMetadata(null);
      if (metadataInput.current) metadataInput.current.value = "";
      if (imagesInput.current) imagesInput.current.value = "";
    } catch (error) {
      if (!abort.signal.aborted) setMessage(inspectionErrorMessage(error));
    } finally {
      if (controller.current === abort) {
        running.current = false;
        if (!abort.signal.aborted) {
          setBusy(false);
          onBusyChange(false);
        }
      }
    }
  }
  return (
    <details className="keyframe-import-panel">
      <summary>匯入同學的關鍵影格</summary>
      <p>
        選擇 Python 工具的 metadata.json，以及同一次輸出 images_original 裡的
        JPEG。關閉前處理時選 images。只在按下送出後上傳至上方設定的 API。
      </p>
      <p>
        這是幾何影格選取，尚未驗證車輛角度或 360°
        覆蓋；請勿以同名增強圖片代替原始車損證據。
      </p>
      <fieldset disabled={busy || disabled}>
        <label>
          影格 metadata.json
          <input
            ref={metadataInput}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              changed();
              setMetadata(e.target.files?.[0] ?? null);
            }}
          />
        </label>
        <label>
          原始關鍵影格 JPEG
          <input
            ref={imagesInput}
            type="file"
            multiple
            accept="image/jpeg,.jpg"
            onChange={(e) => {
              changed();
              setImages(Array.from(e.target.files ?? []));
            }}
          />
        </label>
        <Button
          className="secondary"
          disabled={!metadata || !images.length}
          onClick={() => void validate()}
        >
          驗證影格資料
        </Button>
        <Button disabled={!frames.length || busy} onClick={() => void upload()}>
          上傳關鍵影格並分析
        </Button>
      </fieldset>
      {busy && (
        <Button
          className="secondary"
          onClick={() => {
            controller.current?.abort();
            running.current = false;
            setBusy(false);
            onBusyChange(false);
            setMessage("已停止；若伺服器已建立紀錄，前端取消不會刪除該紀錄。");
          }}
        >
          停止匯入分析
        </Button>
      )}
      <p role="status">{message}</p>
    </details>
  );
}
