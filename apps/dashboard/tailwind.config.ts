import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blush: "#ff5ea8",
        mist: "#bde7ff",
        mint: "#b9ffd7",
        ivory: "#fffefc",
        ink: "#132238"
      },
      boxShadow: {
        glass: "0 24px 80px rgba(12, 23, 41, 0.18)"
      },
      backgroundImage: {
        aurora:
          "radial-gradient(circle at top left, rgba(255, 94, 168, 0.45), transparent 32%), radial-gradient(circle at top right, rgba(189, 231, 255, 0.55), transparent 30%), radial-gradient(circle at bottom, rgba(185, 255, 215, 0.4), transparent 28%)"
      }
    }
  },
  plugins: []
} satisfies Config;

