"use client";

// Each sprite sheet has 3 animals arranged horizontally.
// pos=0 → left third, pos=1 → middle third, pos=2 → right third.
// We use CSS background-size: 300% to stretch the sheet so each animal
// fills the box, then background-position to select the correct one.

interface AnimalSpriteProps {
  sheet: string;
  pos: 0 | 1 | 2;
  size?: number;
  className?: string;
}

const BG_POSITIONS = ["0% center", "50% center", "100% center"] as const;

export default function AnimalSprite({
  sheet,
  pos,
  size = 64,
  className = "",
}: AnimalSpriteProps) {
  return (
    <div
      className={`pixelated flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${sheet})`,
        backgroundSize: "300% auto",
        backgroundPosition: BG_POSITIONS[pos],
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
      }}
      aria-hidden="true"
    />
  );
}
