"use client";

import { useEffect, useRef } from "react";
import PixelButton from "@/components/PixelButton";

interface HowToPlayModalProps {
  onClose: () => void;
}

const STEPS = [
  {
    title: "Start a Focus Session",
    body: "Your webcam checks that you're paying attention.",
  },
  {
    title: "Earn Coins",
    body: "Stay focused during your session to earn coins.",
  },
  {
    title: "Visit the Shop",
    body: "Spend coins on animals and decorations.",
  },
  {
    title: "Grow Your Farm",
    body: "Watch it grow as you stay productive.",
  },
];

const TITLE_ID = "how-to-play-title";

export default function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus management: move focus into the dialog on open, trap Tab/Shift+Tab
  // inside it while open, close on Escape, and give focus back to whatever
  // triggered the modal ("How to Play") on close — without this, a keyboard
  // user opening the modal keeps tabbing through the page *behind* it, and
  // closing it drops focus back to the document body instead of where they
  // were.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function getFocusable(): HTMLElement[] {
      const panel = panelRef.current;
      if (!panel) return [];
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      // Clicking the dimmed backdrop closes the dialog, same as Escape/"Got
      // it" — clicks inside the panel don't bubble here (stopPropagation
      // below), so this only fires for genuine outside-clicks.
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        className="pixel-panel flex flex-col items-center gap-5 w-full max-w-sm p-8 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={TITLE_ID} className="font-pixel text-pixel-lg text-green-400">
          How to Play
        </h2>

        <div className="flex flex-col gap-4 w-full">
          {STEPS.map(({ title, body }, i) => (
            <div key={title} className="flex items-start gap-3">
              <span
                className="font-pixel text-pixel-xs text-green-300 shrink-0 w-6 h-6 flex items-center justify-center rounded"
                style={{ background: "#0f1f0f", outline: "2px solid #2d4a2d" }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-pixel text-pixel-sm text-white">{title}</span>
                {/* Real sentence, not a label — sans .text-body face, same
                    reasoning as ShopItemCard's description (see globals.css). */}
                <span className="text-body text-gray-400">{body}</span>
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
