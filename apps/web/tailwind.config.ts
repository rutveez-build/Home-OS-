import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#F5F1EA", dark: "#0F1114" },
        surface: { DEFAULT: "#FFFFFF", dark: "#1A1D22" },
        ink: "#15171A",
        // Default brand is a deep forest. Override via CSS variables to rebrand
        // without touching components — see globals.css.
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
          deep: "rgb(var(--brand-deep) / <alpha-value>)",
        },
        accent: "#C9A26C",
        coral: "#CB6D54",
        line: { DEFAULT: "#E8E0D2", dark: "#262A33" },
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
