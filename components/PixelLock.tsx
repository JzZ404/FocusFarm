// Small pixel-art padlock — shown top-left on shop cards locked behind a
// focus-minutes requirement (ShopItemCard) and in the "Locked" section
// divider (ShopCatalog). Same SVG-rect technique as DeliveryToast's
// PixelCar (a char-grid → palette-color design converted to run-length-
// encoded <rect>s). Metal shackle reuses the ROCK/ROCK_DARK tones from
// menuScene.js; the body reuses the gold from .pixel-coin-icon so it reads
// as "tied to the coin/reward system" rather than a random new color.
export default function PixelLock({ size = 16 }: { size?: number }) {
  const px = [
    [2, 0, 5, "#7f8fa0"],
    [2, 1, 1, "#7f8fa0"], [6, 1, 1, "#5f6f80"],
    [2, 2, 1, "#7f8fa0"], [6, 2, 1, "#5f6f80"],
    [2, 3, 1, "#7f8fa0"], [6, 3, 1, "#5f6f80"],
    [0, 4, 9, "#3a2e10"],
    [0, 5, 1, "#3a2e10"], [1, 5, 7, "#f0c419"], [8, 5, 1, "#3a2e10"],
    [0, 6, 1, "#3a2e10"], [1, 6, 2, "#f0c419"], [3, 6, 3, "#3a2e10"], [6, 6, 2, "#f0c419"], [8, 6, 1, "#3a2e10"],
    [0, 7, 1, "#3a2e10"], [1, 7, 3, "#f0c419"], [4, 7, 1, "#3a2e10"], [5, 7, 3, "#f0c419"], [8, 7, 1, "#3a2e10"],
    [0, 8, 1, "#3a2e10"], [1, 8, 3, "#f0c419"], [4, 8, 1, "#3a2e10"], [5, 8, 3, "#f0c419"], [8, 8, 1, "#3a2e10"],
    [0, 9, 9, "#3a2e10"],
  ] as const;
  return (
    <svg
      width={size}
      height={(size * 10) / 9}
      viewBox="0 0 9 10"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {px.map(([x, y, w, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={1} fill={fill} />
      ))}
    </svg>
  );
}
