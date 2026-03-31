import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#0B0E14",
        charcoal: "#151A22",
        blush: "#8B5CF6", /* mapped to violet for primary accents */
        cyan: "#06B6D4",
        ivory: "#F8FAFC",
        ink: "#F8FAFC" /* inverted 'ink' for dark mode text */
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.4)"
      },
      backgroundImage: {
        aurora:
          "radial-gradient(circle at top left, rgba(139, 92, 246, 0.15), transparent 40%), radial-gradient(circle at top right, rgba(6, 182, 212, 0.15), transparent 40%), radial-gradient(circle at bottom, rgba(139, 92, 246, 0.1), transparent 40%)"
      }
    }
  },
  plugins: []
} satisfies Config;
