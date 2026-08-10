"use client";

import PixelButton from "@/components/PixelButton";

interface HowToPlayModalProps {
  onClose: () => void;
}

const STEPS = [
  {
    icon: "🎯",
    title: "Start a Focus Session",
    body: "Your webcam checks that you're paying attention.",
  },
  {
    icon: "🪙",
    title: "Earn Coins",
    body: "Stay focused during your session to earn coins.",
  },
  {
    icon: "🛒",
    title: "Visit the Shop",
    body: "Spend coins on animals and decorations.",
  },
  {
    icon: "🐾",
    title: "Grow Your Farm",
    body: "Watch it grow as you stay productive.",
  },
];

export default function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="pixel-panel flex flex-col items-center gap-5 w-full max-w-sm p-8">
        <h2 className="font-pixel text-pixel-lg text-green-400">How to Play</h2>

        <div className="flex flex-col gap-4 w-full">
          {STEPS.map(({ icon, title, body }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="text-xl leading-none">{icon}</span>
              <div className="flex flex-col gap-1">
                <span className="font-pixel text-pixel-sm text-white">{title}</span>
                <span className="font-pixel text-pixel-xs text-gray-400">{body}</span>
              </div>
            </div>
          ))}
        </div>

        <PixelButton className="w-full" onClick={onClose}>
          Got it
        </PixelButton>
      </div>
    </div>
  );
}
