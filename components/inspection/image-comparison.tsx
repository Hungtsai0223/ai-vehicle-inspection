"use client";
import Image from "next/image";
import { useId, useRef, useState, type KeyboardEvent } from "react";
interface ImageComparisonProps {
  beforeImage?: string;
  afterImage?: string;
  maskImage?: string;
  location: string;
  isDemo?: boolean;
}
const labels = ["租車前", "還車時", "AI Mask"];
export function ImageComparison({
  beforeImage,
  afterImage,
  maskImage,
  location,
  isDemo = true,
}: ImageComparisonProps) {
  const [tab, setTab] = useState(0);
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const images = [beforeImage, afterImage, maskImage];
  function keyboard(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let next: number;
    if (e.key === "ArrowRight") next = (i + 1) % 3;
    else if (e.key === "ArrowLeft") next = (i + 2) % 3;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 2;
    else return;
    e.preventDefault();
    setTab(next);
    refs.current[next]?.focus();
  }
  return (
    <div className="image-comparison">
      <div
        role="tablist"
        aria-label={`${location}車損比對影像`}
        className="tabs"
      >
        {labels.map((label, i) => (
          <button
            key={label}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${id}-tab-${i}`}
            role="tab"
            tabIndex={tab === i ? 0 : -1}
            aria-selected={tab === i}
            aria-controls={`${id}-panel`}
            onKeyDown={(e) => keyboard(e, i)}
            onClick={() => setTab(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        tabIndex={0}
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tab}`}
        className="comparison-image"
      >
        {images[tab] ? (
          <Image
            unoptimized
            src={images[tab]}
            alt={`${labels[tab]} · ${location}${isDemo ? "模擬示意" : ""}`}
            width={640}
            height={360}
          />
        ) : (
          <div className="image-empty">影像待提供</div>
        )}
        <span>
          {isDemo ? "Demo Image · 模擬影像，非實際車損證據" : "車況比對影像"}
        </span>
      </div>
    </div>
  );
}
