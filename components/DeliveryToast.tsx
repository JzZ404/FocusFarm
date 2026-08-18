"use client";

import { useEffect, useState } from "react";
import { ShopItem } from "@/data/shopItems";

interface DeliveryToastProps {
  item: ShopItem;
  onDone: () => void;
}

const SHOWN_MS = 2200;
const EXIT_MS = 400;

// Small pixel-art delivery car — replaces the 🚚 emoji that used to sit
// here (and an earlier truck design, redrawn to match a reference sedan:
// stepped dark roofline over three windows, a wide red body with a
// lower-stepped hood extension on one side, black corner bumpers, black
// wheel arches with checkerboard hubs, a grey running board between the
// wheels, and a flat drop shadow). Same char-grid → palette-color technique
// sprites.js uses for the farm art (hard edges only, no smooth curves),
// just emitted as SVG rects instead of canvas fillRects since this lives
// in a plain DOM component.
function PixelCar({ size = 28 }: { size?: number }) {
  const px = [
    [10, 1, 15, "#5c201a"], [10, 2, 15, "#5c201a"],
    [9, 3, 17, "#5c201a"],
    [9, 4, 2, "#5c201a"], [11, 4, 4, "#c4c0d6"], [15, 4, 1, "#5c201a"], [16, 4, 4, "#c4c0d6"], [20, 4, 1, "#5c201a"], [21, 4, 4, "#c4c0d6"], [25, 4, 1, "#5c201a"],
    [9, 5, 2, "#5c201a"], [11, 5, 4, "#c4c0d6"], [15, 5, 1, "#5c201a"], [16, 5, 4, "#c4c0d6"], [20, 5, 1, "#5c201a"], [21, 5, 4, "#c4c0d6"], [25, 5, 1, "#5c201a"],
    [9, 6, 2, "#5c201a"], [11, 6, 4, "#c4c0d6"], [15, 6, 1, "#5c201a"], [16, 6, 4, "#c4c0d6"], [20, 6, 1, "#5c201a"], [21, 6, 4, "#c4c0d6"], [25, 6, 1, "#5c201a"],
    [9, 7, 17, "#5c201a"],
    [3, 8, 27, "#5c201a"],
    [3, 9, 27, "#b03a30"],
    [3, 10, 26, "#b03a30"], [29, 10, 5, "#5c201a"],
    [3, 11, 2, "#1a1412"], [5, 11, 27, "#b03a30"], [32, 11, 2, "#1a1412"],
    [3, 12, 2, "#1a1412"], [5, 12, 1, "#b03a30"], [6, 12, 9, "#1a1412"], [15, 12, 4, "#b03a30"], [19, 12, 9, "#1a1412"], [28, 12, 4, "#b03a30"], [32, 12, 2, "#1a1412"],
    [6, 13, 9, "#1a1412"], [15, 13, 4, "#8c8a8c"], [19, 13, 9, "#1a1412"],
    [7, 14, 2, "#1a1412"], [9, 14, 1, "#c4c4c4"], [10, 14, 2, "#78787c"], [12, 14, 2, "#1a1412"], [20, 14, 2, "#1a1412"], [22, 14, 1, "#c4c4c4"], [23, 14, 2, "#78787c"], [25, 14, 2, "#1a1412"],
    [7, 15, 2, "#1a1412"], [9, 15, 1, "#78787c"], [10, 15, 2, "#c4c4c4"], [12, 15, 2, "#1a1412"], [20, 15, 2, "#1a1412"], [22, 15, 1, "#78787c"], [23, 15, 2, "#c4c4c4"], [25, 15, 2, "#1a1412"],
    [7, 16, 2, "#1a1412"], [9, 16, 1, "#78787c"], [10, 16, 2, "#c4c4c4"], [12, 16, 2, "#1a1412"], [20, 16, 2, "#1a1412"], [22, 16, 1, "#78787c"], [23, 16, 2, "#c4c4c4"], [25, 16, 2, "#1a1412"],
    [3, 17, 28, "#b0b6b6"],
  ] as const;
  return (
    <svg
      width={size}
      height={(size * 18) / 34}
      viewBox="0 0 34 18"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {px.map(([x, y, w, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={1} fill={fill} />
      ))}
    </svg>
  );
}

// Fun little confirmation that a purchase actually happened — before this,
// buying an animal gave no feedback beyond the coin balance quietly
// changing. Framed as "delivery" rather than a generic "Purchased!" toast,
// per the ask.
export default function DeliveryToast({ item, onDone }: DeliveryToastProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), SHOWN_MS);
    const doneTimer = setTimeout(onDone, SHOWN_MS + EXIT_MS);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <div
      className="fixed inset-x-0 top-6 z-[60] flex justify-center px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pixel-panel flex items-center gap-3 px-5 py-3 pointer-events-auto ${
          leaving ? "anim-toast-out" : "anim-toast-in"
        }`}
      >
        <PixelCar size={40} />
        <div className="flex flex-col leading-tight">
          <span className="font-pixel text-pixel-sm text-white whitespace-nowrap">
            {item.name} is on its way!
          </span>
          <span className="font-pixel text-pixel-xs text-gray-400 whitespace-nowrap">
            Delivering to your farm&hellip;
          </span>
        </div>
      </div>
    </div>
  );
}
