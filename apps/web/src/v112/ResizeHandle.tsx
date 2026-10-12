import { useState } from "react";
export function usePanelWidth(
  key: string,
  initial: number,
  min = 200,
  max = 480,
) {
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return saved >= min && saved <= max ? saved : initial;
    } catch {
      return initial;
    }
  });
  return {
    width,
    setWidth: (value: number) => {
      const next = Math.max(min, Math.min(max, value));
      setWidth(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        /* Optional layout preference. */
      }
    },
  };
}
export default function ResizeHandle({
  width,
  change,
  min = 200,
  max = 480,
  label = "Larghezza esplora file",
}: {
  width: number;
  change: (width: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  return (
    <div
      className="panel-resizer"
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      onDoubleClick={() => change(260)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          change(width + (e.key === "ArrowRight" ? 16 : -16));
        }
        if (e.key === "Home") change(min);
        if (e.key === "End") change(max);
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.dataset.start = String(e.clientX);
        e.currentTarget.dataset.width = String(width);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          change(
            Number(e.currentTarget.dataset.width) +
              e.clientX -
              Number(e.currentTarget.dataset.start),
          );
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    />
  );
}
