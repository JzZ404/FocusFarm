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
        pixel: ['"Press Start 2P"', "monospace"],
      },
      colors: {
        farm: {
          grass: "#5a8a3c",
          "grass-light": "#7ab648",
          "grass-dark": "#3d6b28",
          soil: "#8b5e3c",
          sky: "#87ceeb",
          coin: "#fbbf24",
          focused: "#4ade80",
          distracted: "#f87171",
          bg: "#1a2e1a",
          panel: "#0f1f0f",
          border: "#2d4a2d",
        },
      },
      animation: {
        "coin-bounce": "coinBounce 0.4s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        coinBounce: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
