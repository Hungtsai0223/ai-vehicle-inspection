"use client";
import Image from "next/image";
import { useState } from "react";
import type { DamageDetection } from "@/types/inspection";
export function DamageCard({ damage }: { damage: DamageDetection }) {
  const [tab, setTab] = useState(0);
  const images = [damage.beforeImage, damage.afterImage, damage.maskImage];
  return (
    <section className="card damage-card">
      <div className="row">
        <h3>疑似新增車損</h3>
        <span className="alert-label">待人工確認</span>
      </div>
      <p>Potential New Damage</p>
      <div className="damage-meta">
        <strong>
          左前車門 <small>Left Front Door</small>
        </strong>
        <span>疑似刮痕 · Scratch</span>
        <b>
          {Math.round(damage.confidence * 100)}% <small>AI 信心度</small>
        </b>
      </div>
      <div role="tablist" aria-label="車損比對影像" className="tabs">
        {["租車前", "還車時", "AI Mask"].map((label, i) => (
          <button
            key={label}
            id={`image-tab-${i}`}
            role="tab"
            aria-selected={tab === i}
            aria-controls="damage-image"
            onClick={() => setTab(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="damage-image"
        aria-labelledby={`image-tab-${tab}`}
        className="comparison-image"
      >
        {/* Explicit SVG mock placeholders, not actual rental evidence. */}
        <Image
          unoptimized
          src={images[tab] ?? "/mock/after.svg"}
          alt={`${["租車前", "還車時", "AI 遮罩"][tab]}左前車門模擬示意`}
          width="640"
          height="360"
        />
        <span>模擬影像 · 非實際車損證據</span>
      </div>
    </section>
  );
}
