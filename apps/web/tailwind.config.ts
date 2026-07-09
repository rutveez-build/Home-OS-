import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#F2EEE1", dark: "#17130B" },
        surface: { DEFAULT: "#FFFDF7", dark: "#211B10" },
        ink: "#241C10",
        // Default brand is a deep turmeric. Override via CSS variables to
        // rebrand without touching components — see globals.css.
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
          deep: "rgb(var(--brand-deep) / <alpha-value>)",
        },
        accent: "#5B7052",
        coral: "#A8481F",
        line: { DEFAULT: "#E1D8C2", dark: "#322A1A" },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        bubble: "0 1px 2px rgba(21,23,26,0.04), 0 1px 1px rgba(21,23,26,0.02)",
        sheet: "0 -8px 30px rgba(21,23,26,0.10)",
      },
      animation: {
        "bubble-in": "bubble-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "fade-in": "fade-in 180ms ease-out",
        "slide-up": "slide-up 280ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "pulse-soft": "pulse-soft 1.4s ease-in-out infinite",
      },
      keyframes: {
        "bubble-in": {
          "0%": { opacity: "0", transform: "translateY(3px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
