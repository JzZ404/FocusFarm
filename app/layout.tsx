import type { Metadata } from "next";
import "./globals.css";
import { FarmProvider } from "@/context/FarmContext";
import { SessionProvider } from "@/context/SessionContext";
import BackgroundMusic from "@/components/BackgroundMusic";

export const metadata: Metadata = {
  title: "FocusFarm — Grow your farm by staying focused",
  description:
    "A gamified productivity app where you earn coins by focusing and build a pixelated farm.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: "#1a2e1a" }}>
        <FarmProvider>
          {/* SessionProvider lives at root so the timer keeps running
              even when the user navigates away from /session */}
          <SessionProvider>
            {children}
            <BackgroundMusic />
          </SessionProvider>
        </FarmProvider>
      </body>
    </html>
  );
}
