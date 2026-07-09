#!/bin/bash

# ─── FocusFarm Project Scaffold ───────────────────────────────────────────────
# Run this from the ROOT of your repo (final-project-codebase-JzZ404/)
# Usage: bash scaffold.sh

echo "🌾 Scaffolding FocusFarm..."

# ─── 1. Create folder structure ───────────────────────────────────────────────
mkdir -p app/session
mkdir -p app/shop
mkdir -p components
mkdir -p lib
mkdir -p context
mkdir -p data
mkdir -p public/assets

echo "✅ Folders created"

# ─── 2. package.json ──────────────────────────────────────────────────────────
cat > package.json << 'EOF'
{
  "name": "focusfarm",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
    "@mediapipe/tasks-vision": "^0.10.14"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "tailwindcss": "^3.3.0",
    "eslint": "^8",
    "eslint-config-next": "14.2.3"
  }
}
EOF

# ─── 3. tsconfig.json ─────────────────────────────────────────────────────────
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

# ─── 4. next.config.js ────────────────────────────────────────────────────────
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
module.exports = nextConfig;
EOF

# ─── 5. tailwind.config.ts ────────────────────────────────────────────────────
cat > tailwind.config.ts << 'EOF'
import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["'Press Start 2P'", "monospace"],
        body: ["'DM Mono'", "monospace"],
      },
      colors: {
        farm: {
          grass: "#5a8a3c",
          "grass-light": "#6ea84a",
          "grass-dark": "#3d6128",
          soil: "#8b5e3c",
          sky: "#87ceeb",
          gold: "#ffd700",
          "gold-dark": "#c8a200",
          bark: "#6b4226",
        },
      },
    },
  },
  plugins: [],
};
export default config;
EOF

# ─── 6. postcss.config.js ─────────────────────────────────────────────────────
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF

# ─── 7. .eslintrc.json ────────────────────────────────────────────────────────
cat > .eslintrc.json << 'EOF'
{
  "extends": "next/core-web-vitals"
}
EOF

# ─── 8. app/globals.css ───────────────────────────────────────────────────────
cat > app/globals.css << 'EOF'
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=DM+Mono:wght@400;500&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0d1117;
  color: #e6edf3;
  font-family: 'DM Mono', monospace;
  image-rendering: pixelated;
}

.pixel-art {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}

.farm-tile {
  width: 48px;
  height: 48px;
  border: 1px solid rgba(255,255,255,0.04);
  image-rendering: pixelated;
}

.btn-pixel {
  position: relative;
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.btn-pixel:active {
  transform: translateY(2px);
  box-shadow: none !important;
}

@keyframes focusPulse {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(90, 200, 90, 0.4); }
  50% { box-shadow: 0 0 20px 8px rgba(90, 200, 90, 0.7); }
}
@keyframes distractFlash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-focus-pulse { animation: focusPulse 2s ease-in-out infinite; }
.animate-distract-flash { animation: distractFlash 0.6s ease-in-out infinite; }
.animate-float { animation: float 3s ease-in-out infinite; }
.animate-slide-up { animation: slideUp 0.35s ease-out; }
EOF

# ─── 9. app/layout.tsx ────────────────────────────────────────────────────────
cat > app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import "./globals.css";
import { FarmProvider } from "@/context/FarmContext";
import { SessionProvider } from "@/context/SessionContext";

export const metadata: Metadata = {
  title: "FocusFarm",
  description: "Grow your farm by staying focused",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0d1117] text-white antialiased">
        <FarmProvider>
          <SessionProvider>
            {children}
          </SessionProvider>
        </FarmProvider>
      </body>
    </html>
  );
}
EOF

# ─── 10. app/page.tsx ─────────────────────────────────────────────────────────
cat > app/page.tsx << 'EOF'
import Link from "next/link";

export default function FarmPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="font-pixel text-lg text-farm-grass tracking-wider">
          🌾 FOCUSFARM
        </div>
        <nav className="flex gap-4">
          <Link href="/session" className="font-pixel text-xs px-4 py-2 rounded-lg bg-farm-grass hover:bg-farm-grass-light text-white transition-colors">
            FOCUS
          </Link>
          <Link href="/shop" className="font-pixel text-xs px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 transition-colors">
            SHOP
          </Link>
        </nav>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-12">
        <div className="text-center">
          <div className="font-pixel text-4xl text-farm-grass mb-4 animate-float">🌱</div>
          <h1 className="font-pixel text-xl text-white/80 mb-3">YOUR FARM</h1>
          <p className="font-body text-sm text-white/40 max-w-sm leading-relaxed">
            Complete focus sessions to earn coins, then visit the shop to buy animals and decorations.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: "COINS", value: "0", icon: "🪙" },
            { label: "SESSIONS", value: "0", icon: "⏱" },
            { label: "ANIMALS", value: "0", icon: "🐔" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-5 min-w-[110px]">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="font-pixel text-lg text-white/80">{value}</div>
              <div className="font-body text-xs text-white/30 mt-1">{label}</div>
            </div>
          ))}
        </div>
        <Link href="/session" className="btn-pixel font-pixel text-sm px-8 py-4 rounded-xl bg-farm-grass hover:bg-farm-grass-light text-white transition-all">
          START FOCUS SESSION →
        </Link>
      </div>
    </main>
  );
}
EOF

# ─── 11. app/session/page.tsx ─────────────────────────────────────────────────
cat > app/session/page.tsx << 'EOF'
"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { useWebcam } from "@/lib/useWebcam";
import { useAttention } from "@/lib/useAttention";
import AttentionHUD from "@/components/AttentionHUD";

export default function SessionPage() {
  const { videoRef, status: webcamStatus, error: webcamError, start: startWebcam, stop: stopWebcam } = useWebcam();
  const { attentionState, landmarkerReady, landmarkerError, startDetection, stopDetection } = useAttention();

  useEffect(() => {
    if (webcamStatus === "active" && landmarkerReady && videoRef.current) {
      startDetection(videoRef.current);
    } else if (webcamStatus !== "active") {
      stopDetection();
    }
  }, [webcamStatus, landmarkerReady, videoRef, startDetection, stopDetection]);

  const handleStop = useCallback(() => {
    stopDetection();
    stopWebcam();
  }, [stopDetection, stopWebcam]);

  const { isFocused, isDetecting, faceDetected } = attentionState;
  const bgClass = isDetecting
    ? isFocused ? "from-green-950/50 to-[#0d1117]" : "from-red-950/40 to-[#0d1117]"
    : "from-gray-900/30 to-[#0d1117]";

  return (
    <main className={`min-h-screen bg-gradient-to-b ${bgClass} transition-all duration-700 flex flex-col`}>
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <Link href="/" className="font-pixel text-sm text-farm-grass hover:text-farm-grass-light transition-colors">← FARM</Link>
        <span className="font-pixel text-xs text-white/30">FOCUS SESSION</span>
        <div className="w-16" />
      </nav>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-10">
          <div className="text-center">
            <div className={`font-pixel text-5xl mb-3 transition-all duration-500 ${
              !isDetecting ? "text-white/20"
              : isFocused ? "text-green-400 animate-focus-pulse"
              : "text-red-400 animate-distract-flash"
            }`}>
              {!isDetecting ? "◌" : isFocused ? "◉" : "◎"}
            </div>
            <div className={`font-pixel text-lg tracking-widest transition-colors duration-300 ${
              !isDetecting ? "text-white/20"
              : isFocused ? "text-green-300"
              : faceDetected ? "text-orange-300"
              : "text-red-400"
            }`}>
              {!isDetecting ? "WAITING" : isFocused ? "FOCUSED" : faceDetected ? "DISTRACTED" : "LOOK AT SCREEN"}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 min-w-[220px]">
            <AttentionHUD
              attentionState={attentionState}
              webcamStatus={webcamStatus}
              webcamError={webcamError}
              landmarkerReady={landmarkerReady}
              landmarkerError={landmarkerError}
              videoRef={videoRef}
              onStartWebcam={startWebcam}
            />
          </div>
          <div className="flex gap-4">
            {webcamStatus === "active" ? (
              <button onClick={handleStop} className="btn-pixel font-pixel text-xs px-6 py-3 rounded-xl bg-red-900/60 hover:bg-red-800/70 text-red-300 border border-red-700/50 transition-all">
                STOP SESSION
              </button>
            ) : (
              <button onClick={startWebcam} className="btn-pixel font-pixel text-sm px-8 py-4 rounded-xl bg-farm-grass hover:bg-farm-grass-light text-white transition-all">
                START SESSION
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
EOF

# ─── 12. app/shop/page.tsx ────────────────────────────────────────────────────
cat > app/shop/page.tsx << 'EOF'
import Link from "next/link";

export default function ShopPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-12">
      <div className="font-pixel text-3xl animate-float">🏪</div>
      <h1 className="font-pixel text-lg text-white/70">SHOP</h1>
      <p className="font-body text-sm text-white/30">Coming in PR #6</p>
      <Link href="/" className="font-pixel text-xs px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 transition-colors">
        ← BACK TO FARM
      </Link>
    </main>
  );
}
EOF

# ─── 13. lib/types.ts ─────────────────────────────────────────────────────────
cat > lib/types.ts << 'EOF'
export interface UserProfile {
  userId: string;
  createdAt: number;
  totalFocusMinutes: number;
  totalSessions: number;
  currentStreak: number;
  lastSessionDate: string;
}

export interface CoinLedger {
  balance: number;
  transactions: CoinTransaction[];
}

export interface CoinTransaction {
  id: string;
  type: "earned" | "spent";
  amount: number;
  reason: string;
  timestamp: number;
}

export interface FocusSession {
  id: string;
  startTime: number;
  endTime: number | null;
  targetMinutes: number;
  actualFocusedSeconds: number;
  distractedSeconds: number;
  coinsEarned: number;
  completed: boolean;
}

export interface FarmGrid {
  gridWidth: number;
  gridHeight: number;
  tiles: FarmTile[];
}

export interface FarmTile {
  id: string;
  itemId: string;
  gridX: number;
  gridY: number;
  placedAt: number;
}

export interface ShopItem {
  id: string;
  name: string;
  category: "animal" | "building" | "decoration";
  cost: number;
  spriteSheet: string;
  spriteX: number;
  spriteY: number;
  spriteSize: number;
  description: string;
  unlockCondition?: string;
}

export interface AttentionState {
  isDetecting: boolean;
  isFocused: boolean;
  faceDetected: boolean;
  eyeAspectRatio: number;
  lastUpdateMs: number;
}

export type SessionStatus = "idle" | "running" | "paused" | "completed" | "abandoned";

export interface SessionState {
  status: SessionStatus;
  sessionId: string | null;
  startTime: number | null;
  targetMinutes: number;
  focusedSeconds: number;
  distractedSeconds: number;
  coinsEarned: number;
}
EOF

# ─── 14. lib/storage.ts ───────────────────────────────────────────────────────
cat > lib/storage.ts << 'EOF'
import { UserProfile, CoinLedger, FocusSession, FarmGrid } from "./types";

const KEYS = {
  PROFILE: "focusfarm:profile",
  COINS: "focusfarm:coins",
  SESSIONS: "focusfarm:sessions",
  FARM: "focusfarm:farm",
} as const;

const MAX_SESSIONS = 50;

function storageGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function storageSet<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("[FocusFarm] localStorage write failed:", e);
    return false;
  }
}

function storageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(key); } catch { }
}

function defaultProfile(): UserProfile {
  return { userId: crypto.randomUUID(), createdAt: Date.now(), totalFocusMinutes: 0, totalSessions: 0, currentStreak: 0, lastSessionDate: "" };
}

export function getProfile(): UserProfile { return storageGet<UserProfile>(KEYS.PROFILE) ?? defaultProfile(); }
export function saveProfile(profile: UserProfile): boolean { return storageSet(KEYS.PROFILE, profile); }
export function initProfileIfMissing(): UserProfile {
  const existing = storageGet<UserProfile>(KEYS.PROFILE);
  if (existing) return existing;
  const fresh = defaultProfile();
  storageSet(KEYS.PROFILE, fresh);
  return fresh;
}

export function getCoinLedger(): CoinLedger { return storageGet<CoinLedger>(KEYS.COINS) ?? { balance: 0, transactions: [] }; }
export function saveCoinLedger(ledger: CoinLedger): boolean { return storageSet(KEYS.COINS, ledger); }
export function getBalance(): number { return getCoinLedger().balance; }

export function getSessions(): FocusSession[] { return storageGet<FocusSession[]>(KEYS.SESSIONS) ?? []; }
export function saveSession(session: FocusSession): boolean {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session; else sessions.push(session);
  return storageSet(KEYS.SESSIONS, sessions.slice(-MAX_SESSIONS));
}

export function getFarmGrid(): FarmGrid { return storageGet<FarmGrid>(KEYS.FARM) ?? { gridWidth: 12, gridHeight: 8, tiles: [] }; }
export function saveFarmGrid(farm: FarmGrid): boolean { return storageSet(KEYS.FARM, farm); }
export function clearAllData(): void { Object.values(KEYS).forEach(storageRemove); }
EOF

# ─── 15. lib/farmUtils.ts ─────────────────────────────────────────────────────
cat > lib/farmUtils.ts << 'EOF'
import { FarmGrid, FarmTile } from "./types";

export function isCellOccupied(farm: FarmGrid, gridX: number, gridY: number): boolean {
  return farm.tiles.some((t) => t.gridX === gridX && t.gridY === gridY);
}

export function isWithinBounds(farm: FarmGrid, gridX: number, gridY: number): boolean {
  return gridX >= 0 && gridX < farm.gridWidth && gridY >= 0 && gridY < farm.gridHeight;
}

export function canPlaceTile(farm: FarmGrid, gridX: number, gridY: number): boolean {
  return isWithinBounds(farm, gridX, gridY) && !isCellOccupied(farm, gridX, gridY);
}

export function addTile(farm: FarmGrid, tile: FarmTile): FarmGrid {
  return { ...farm, tiles: [...farm.tiles, tile] };
}

export function removeTile(farm: FarmGrid, tileId: string): FarmGrid {
  return { ...farm, tiles: farm.tiles.filter((t) => t.id !== tileId) };
}
EOF

# ─── 16. lib/attention.ts ─────────────────────────────────────────────────────
cat > lib/attention.ts << 'EOF'
"use client";

import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { AttentionState } from "./types";

const LEFT_EYE_UPPER = [386, 387, 388, 390];
const LEFT_EYE_LOWER = [374, 373, 390, 380];
const LEFT_EYE_CORNER = { inner: 362, outer: 263 };
const RIGHT_EYE_UPPER = [159, 160, 161, 163];
const RIGHT_EYE_LOWER = [145, 144, 163, 153];
const RIGHT_EYE_CORNER = { inner: 133, outer: 33 };
const EAR_THRESHOLD = 0.20;
const DISTRACT_FRAMES = 8;

let landmarker: FaceLandmarker | null = null;
let isLoading = false;

export async function initLandmarker(): Promise<FaceLandmarker> {
  if (landmarker) return landmarker;
  if (isLoading) {
    await new Promise<void>((res) => {
      const id = setInterval(() => { if (landmarker) { clearInterval(id); res(); } }, 100);
    });
    return landmarker!;
  }
  isLoading = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    return landmarker;
  } finally { isLoading = false; }
}

function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function computeEAR(landmarks: { x: number; y: number; z: number }[], upper: number[], lower: number[], corners: { inner: number; outer: number }): number {
  const v1 = dist(landmarks[upper[0]], landmarks[lower[0]]);
  const v2 = dist(landmarks[upper[1]], landmarks[lower[1]]);
  const h = dist(landmarks[corners.inner], landmarks[corners.outer]);
  if (h === 0) return 0;
  return (v1 + v2) / (2 * h);
}

export function processFrame(landmarkerInstance: FaceLandmarker, videoEl: HTMLVideoElement, timestampMs: number): { faceDetected: boolean; ear: number } {
  const result: FaceLandmarkerResult = landmarkerInstance.detectForVideo(videoEl, timestampMs);
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) return { faceDetected: false, ear: 0 };
  const lm = result.faceLandmarks[0];
  const leftEAR = computeEAR(lm, LEFT_EYE_UPPER, LEFT_EYE_LOWER, LEFT_EYE_CORNER);
  const rightEAR = computeEAR(lm, RIGHT_EYE_UPPER, RIGHT_EYE_LOWER, RIGHT_EYE_CORNER);
  return { faceDetected: true, ear: (leftEAR + rightEAR) / 2 };
}

export class AttentionTracker {
  private distractedFrames = 0;
  private _isFocused = false;
  update(faceDetected: boolean, ear: number): boolean {
    if (!faceDetected || ear < EAR_THRESHOLD) {
      this.distractedFrames++;
      if (this.distractedFrames >= DISTRACT_FRAMES) this._isFocused = false;
    } else {
      this.distractedFrames = 0;
      this._isFocused = true;
    }
    return this._isFocused;
  }
  get isFocused(): boolean { return this._isFocused; }
  reset(): void { this.distractedFrames = 0; this._isFocused = false; }
}

export function defaultAttentionState(): AttentionState {
  return { isDetecting: false, isFocused: false, faceDetected: false, eyeAspectRatio: 0, lastUpdateMs: 0 };
}
EOF

# ─── 17. lib/useWebcam.ts ─────────────────────────────────────────────────────
cat > lib/useWebcam.ts << 'EOF'
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type WebcamStatus = "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";

export interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  status: WebcamStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<WebcamStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; setStream(null); }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle"); setError(null);
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("unavailable"); setError("Webcam is not supported in this browser."); return; }
    setStatus("requesting"); setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
      streamRef.current = mediaStream; setStream(mediaStream);
      if (videoRef.current) { videoRef.current.srcObject = mediaStream; await videoRef.current.play(); }
      setStatus("active");
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") { setStatus("denied"); setError("Camera access was denied. Please allow camera access in your browser settings."); }
        else if (err.name === "NotFoundError") { setStatus("unavailable"); setError("No camera found. Please connect a webcam and try again."); }
        else { setStatus("error"); setError(`Camera error: ${err.message}`); }
      } else { setStatus("error"); setError("An unexpected error occurred while accessing the camera."); }
    }
  }, []);

  useEffect(() => { return () => { stop(); }; }, [stop]);

  return { videoRef, stream, status, error, start, stop };
}
EOF

# ─── 18. lib/useAttention.ts ──────────────────────────────────────────────────
cat > lib/useAttention.ts << 'EOF'
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FaceLandmarker, initLandmarker, processFrame, AttentionTracker, defaultAttentionState } from "./attention";
import { AttentionState } from "./types";

export interface UseAttentionReturn {
  attentionState: AttentionState;
  landmarkerReady: boolean;
  landmarkerError: string | null;
  startDetection: (videoEl: HTMLVideoElement) => void;
  stopDetection: () => void;
}

export function useAttention(): UseAttentionReturn {
  const [attentionState, setAttentionState] = useState<AttentionState>(defaultAttentionState());
  const [landmarkerReady, setLandmarkerReady] = useState(false);
  const [landmarkerError, setLandmarkerError] = useState<string | null>(null);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const trackerRef = useRef(new AttentionTracker());
  const rafRef = useRef<number | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const detectingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    initLandmarker().then((lm) => { if (!cancelled) { landmarkerRef.current = lm; setLandmarkerReady(true); } })
      .catch((err) => { if (!cancelled) { console.error("[FocusFarm] MediaPipe load failed:", err); setLandmarkerError("Failed to load face detection. Sessions will run as a plain timer."); } });
    return () => { cancelled = true; };
  }, []);

  const runLoop = useCallback(() => {
    if (!detectingRef.current) return;
    const lm = landmarkerRef.current;
    const video = videoElRef.current;
    if (lm && video && video.readyState >= 2) {
      try {
        const { faceDetected, ear } = processFrame(lm, video, performance.now());
        const isFocused = trackerRef.current.update(faceDetected, ear);
        setAttentionState({ isDetecting: true, isFocused, faceDetected, eyeAspectRatio: ear, lastUpdateMs: Date.now() });
      } catch { }
    }
    rafRef.current = requestAnimationFrame(runLoop);
  }, []);

  const startDetection = useCallback((videoEl: HTMLVideoElement) => {
    videoElRef.current = videoEl;
    trackerRef.current.reset();
    detectingRef.current = true;
    setAttentionState((prev) => ({ ...prev, isDetecting: true }));
    rafRef.current = requestAnimationFrame(runLoop);
  }, [runLoop]);

  const stopDetection = useCallback(() => {
    detectingRef.current = false;
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    videoElRef.current = null;
    trackerRef.current.reset();
    setAttentionState(defaultAttentionState());
  }, []);

  useEffect(() => { return () => { detectingRef.current = false; if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }; }, []);

  return { attentionState, landmarkerReady, landmarkerError, startDetection, stopDetection };
}
EOF

# ─── 19. components/AttentionHUD.tsx ──────────────────────────────────────────
cat > components/AttentionHUD.tsx << 'EOF'
"use client";

import { useState } from "react";
import { AttentionState } from "@/lib/types";
import { WebcamStatus } from "@/lib/useWebcam";

interface AttentionHUDProps {
  attentionState: AttentionState;
  webcamStatus: WebcamStatus;
  webcamError: string | null;
  landmarkerReady: boolean;
  landmarkerError: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  onStartWebcam: () => void;
  showPreview?: boolean;
}

export default function AttentionHUD({ attentionState, webcamStatus, webcamError, landmarkerReady, landmarkerError, videoRef, onStartWebcam, showPreview = true }: AttentionHUDProps) {
  const [previewVisible, setPreviewVisible] = useState(showPreview);
  const { isDetecting, isFocused, faceDetected, eyeAspectRatio } = attentionState;

  const statusLabel = (() => {
    if (webcamStatus === "idle") return { text: "CAMERA OFF", color: "text-gray-400", bg: "bg-gray-800", dot: "bg-gray-500" };
    if (webcamStatus === "requesting") return { text: "CONNECTING...", color: "text-yellow-300", bg: "bg-yellow-900/40", dot: "bg-yellow-400 animate-pulse" };
    if (["denied","unavailable","error"].includes(webcamStatus)) return { text: "NO CAMERA", color: "text-red-400", bg: "bg-red-900/30", dot: "bg-red-500" };
    if (!landmarkerReady && !landmarkerError) return { text: "LOADING AI...", color: "text-blue-300", bg: "bg-blue-900/40", dot: "bg-blue-400 animate-pulse" };
    if (landmarkerError) return { text: "TIMER MODE", color: "text-orange-300", bg: "bg-orange-900/30", dot: "bg-orange-400" };
    if (!isDetecting) return { text: "STANDBY", color: "text-gray-400", bg: "bg-gray-800", dot: "bg-gray-500" };
    if (!faceDetected) return { text: "LOOK AT SCREEN", color: "text-red-400", bg: "bg-red-900/40", dot: "bg-red-500 animate-distract-flash" };
    if (isFocused) return { text: "FOCUSED", color: "text-green-300", bg: "bg-green-900/40", dot: "bg-green-400 animate-focus-pulse" };
    return { text: "DISTRACTED", color: "text-orange-400", bg: "bg-orange-900/40", dot: "bg-orange-400 animate-distract-flash" };
  })();

  return (
    <div className="flex flex-col gap-3 select-none">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-pixel text-xs ${statusLabel.bg} border border-white/10`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusLabel.dot}`} />
        <span className={statusLabel.color}>{statusLabel.text}</span>
      </div>
      {process.env.NODE_ENV === "development" && isDetecting && (
        <div className="font-body text-xs text-white/30 text-center">EAR: {eyeAspectRatio.toFixed(3)}</div>
      )}
      <div className="relative">
        <video ref={videoRef} autoPlay playsInline muted
          className={`rounded-xl border-2 transition-all duration-300 ${previewVisible && webcamStatus === "active" ? "w-48 h-36 opacity-100" : "w-0 h-0 opacity-0 pointer-events-none"} ${isFocused ? "border-green-500/60" : "border-red-500/40"}`}
          style={{ imageRendering: "pixelated" }} />
        {webcamStatus === "active" && (
          <button onClick={() => setPreviewVisible((v) => !v)}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-700 border border-white/20 flex items-center justify-center font-body text-xs text-white/60 hover:text-white transition-colors">
            {previewVisible ? "×" : "◎"}
          </button>
        )}
      </div>
      {(webcamError || landmarkerError) && (
        <div className="font-body text-xs text-white/50 max-w-[12rem] leading-relaxed text-center">{webcamError ?? landmarkerError}</div>
      )}
      {webcamStatus === "idle" && (
        <button onClick={onStartWebcam} className="font-pixel text-xs px-3 py-2 rounded-lg bg-farm-grass hover:bg-farm-grass-light text-white transition-colors">
          START CAMERA
        </button>
      )}
    </div>
  );
}
EOF

# ─── 20. context/FarmContext.tsx ──────────────────────────────────────────────
cat > context/FarmContext.tsx << 'EOF'
"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { CoinLedger, FarmGrid, UserProfile } from "@/lib/types";
import { getCoinLedger, getFarmGrid, initProfileIfMissing, saveCoinLedger } from "@/lib/storage";

interface FarmContextValue {
  profile: UserProfile | null;
  coins: number;
  farm: FarmGrid;
  isHydrated: boolean;
  earnCoins: (amount: number, reason: string) => void;
  spendCoins: (amount: number, reason: string) => boolean;
}

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ledger, setLedger] = useState<CoinLedger>({ balance: 0, transactions: [] });
  const [farm, setFarm] = useState<FarmGrid>({ gridWidth: 12, gridHeight: 8, tiles: [] });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setProfile(initProfileIfMissing());
    setLedger(getCoinLedger());
    setFarm(getFarmGrid());
    setIsHydrated(true);
  }, []);

  const earnCoins = useCallback((amount: number, reason: string) => {
    setLedger((prev) => {
      const updated = { balance: prev.balance + amount, transactions: [...prev.transactions, { id: crypto.randomUUID(), type: "earned" as const, amount, reason, timestamp: Date.now() }] };
      saveCoinLedger(updated);
      return updated;
    });
  }, []);

  const spendCoins = useCallback((amount: number, reason: string): boolean => {
    let success = false;
    setLedger((prev) => {
      if (prev.balance < amount) return prev;
      const updated = { balance: prev.balance - amount, transactions: [...prev.transactions, { id: crypto.randomUUID(), type: "spent" as const, amount, reason, timestamp: Date.now() }] };
      saveCoinLedger(updated);
      success = true;
      return updated;
    });
    return success;
  }, []);

  return (
    <FarmContext.Provider value={{ profile, coins: ledger.balance, farm, isHydrated, earnCoins, spendCoins }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm(): FarmContextValue {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error("useFarm must be used inside <FarmProvider>");
  return ctx;
}
EOF

# ─── 21. context/SessionContext.tsx ──────────────────────────────────────────
cat > context/SessionContext.tsx << 'EOF'
"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { SessionState } from "@/lib/types";

interface SessionContextValue {
  sessionState: SessionState;
  startSession: (targetMinutes: number) => void;
  endSession: () => void;
  abandonSession: () => void;
  addFocusedSecond: () => void;
  addDistractedSecond: () => void;
}

const defaultSession: SessionState = { status: "idle", sessionId: null, startTime: null, targetMinutes: 25, focusedSeconds: 0, distractedSeconds: 0, coinsEarned: 0 };
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionState, setSessionState] = useState<SessionState>(defaultSession);

  const startSession = useCallback((targetMinutes: number) => {
    setSessionState({ status: "running", sessionId: crypto.randomUUID(), startTime: Date.now(), targetMinutes, focusedSeconds: 0, distractedSeconds: 0, coinsEarned: 0 });
  }, []);
  const endSession = useCallback(() => setSessionState((prev) => ({ ...prev, status: "completed" })), []);
  const abandonSession = useCallback(() => setSessionState(defaultSession), []);
  const addFocusedSecond = useCallback(() => setSessionState((prev) => ({ ...prev, focusedSeconds: prev.focusedSeconds + 1 })), []);
  const addDistractedSecond = useCallback(() => setSessionState((prev) => ({ ...prev, distractedSeconds: prev.distractedSeconds + 1 })), []);

  return (
    <SessionContext.Provider value={{ sessionState, startSession, endSession, abandonSession, addFocusedSecond, addDistractedSecond }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
EOF

# ─── 22. data/shopItems.ts ────────────────────────────────────────────────────
cat > data/shopItems.ts << 'EOF'
import { ShopItem } from "@/lib/types";
// Full catalog ships in PR #6
export const SHOP_ITEMS: ShopItem[] = [];
export function getItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}
EOF

# ─── 23. data/rewardTiers.ts ──────────────────────────────────────────────────
cat > data/rewardTiers.ts << 'EOF'
export interface RewardTier { minMinutes: number; multiplier: number; label: string; }
export const REWARD_TIERS: RewardTier[] = [
  { minMinutes: 0,  multiplier: 1.0, label: "Starter" },
  { minMinutes: 10, multiplier: 1.0, label: "Focused" },
  { minMinutes: 20, multiplier: 1.5, label: "Deep Work" },
  { minMinutes: 30, multiplier: 2.0, label: "Flow State" },
];
export const COINS_PER_FOCUSED_MINUTE = 10;
EOF

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "✅ All files created!"
echo ""
echo "Next steps:"
echo "  1. npm install"
echo "  2. npm run dev"
echo "  3. Open http://localhost:3000"
echo ""
echo "Then create two branches and PRs:"
echo "  PR #1 → everything except lib/attention.ts, lib/useWebcam.ts, lib/useAttention.ts, components/AttentionHUD.tsx, app/session/page.tsx"
echo "  PR #2 → the 5 files above"
