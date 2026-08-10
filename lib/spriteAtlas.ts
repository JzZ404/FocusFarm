// Shared loader for the animal sprite atlas (public/animals/atlas.json +
// atlas.png). FarmCanvas has its own private copy of this same logic for
// the main farm scene — this one is for lighter-weight sprite usage
// elsewhere (e.g. WalkingFox) that doesn't need the full farm scene setup.
// Both hit the same URLs, so the browser HTTP cache makes a second load
// effectively free even though the JS-level cache below isn't shared.

export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}
interface AtlasJson {
  frames: Record<string, AtlasFrame>;
}

let atlasImg: HTMLImageElement | null = null;
let atlasFrames: Record<string, AtlasFrame> | null = null;
let atlasPromise: Promise<void> | null = null;

export function loadAtlas(): Promise<void> {
  if (atlasPromise) return atlasPromise;
  atlasPromise = Promise.all([
    fetch("/animals/atlas.json").then((r) => r.json() as Promise<AtlasJson>),
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = "/animals/atlas.png";
    }),
  ])
    .then(([json, img]) => {
      atlasFrames = json.frames;
      atlasImg = img;
    })
    .catch(() => {});
  return atlasPromise;
}

export function getAtlasImage(): HTMLImageElement | null {
  return atlasImg;
}

export function getAtlasFrames(): Record<string, AtlasFrame> | null {
  return atlasFrames;
}
