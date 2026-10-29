"use client";

import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type StarRatingProps = {
  value: number;
  onChange: (value: number) => void;
};

const STEP = 0.25;

function clamp(n: number) {
  return Math.min(5, Math.max(0, n));
}

export default function StarRating({ value, onChange }: StarRatingProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  function valueFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return value;

    const rect = track.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 5;

    return clamp(Math.round(raw / STEP) * STEP);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onChange(valueFromPointer(event.clientX));
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    onChange(valueFromPointer(event.clientX));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(clamp(value + STEP));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(clamp(value - STEP));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(5);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Book rating"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-valuetext={value === 0 ? "Not rated" : `${value} out of 5 stars`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        className="relative inline-block cursor-pointer touch-none select-none text-4xl leading-none outline-none focus-visible:ring-2 focus-visible:ring-[#9B866A]"
      >
        <span className="whitespace-nowrap text-[#D8CEBD]">★★★★★</span>
        <span
          className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-[#B68E4A]"
          style={{ width: `${(value / 5) * 100}%` }}
          aria-hidden="true"
        >
          ★★★★★
        </span>
      </div>

      <span className="text-sm text-[#8C7D6A]">
        {value === 0 ? "Not rated" : `${value} out of 5`}
      </span>

      {value > 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="text-xs text-[#837461] underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}