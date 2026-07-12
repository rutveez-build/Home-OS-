import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Kitchen Stream" design system (Stitch project HomeOS Kitchen Chat).
        // Values live as CSS variables in globals.css so dark mode flips them
        // automatically via prefers-color-scheme — no dark: classes needed.
        stream: {
          primary: "rgb(var(--ks-primary) / <alpha-value>)",
          "on-primary": "rgb(var(--ks-on-primary) / <alpha-value>)",
          accent: "rgb(var(--ks-accent) / <alpha-value>)",
          header: "rgb(var(--ks-header) / <alpha-value>)",
          "on-header": "rgb(var(--ks-on-header) / <alpha-value>)",
          bg: "rgb(var(--ks-bg) / <alpha-value>)",
          chat: "rgb(var(--ks-chat) / <alpha-value>)",
          surface: "rgb(var(--ks-surface) / <alpha-value>)",
          "surface-2": "rgb(var(--ks-surface-2) / <alpha-value>)",
          "bubble-in": "rgb(var(--ks-bubble-in) / <alpha-value>)",
          "bubble-out": "rgb(var(--ks-bubble-out) / <alpha-value>)",
          "on-bubble-out": "rgb(var(--ks-on-bubble-out) / <alpha-value>)",
          ink: "rgb(var(--ks-ink) / <alpha-value>)",
          mute: "rgb(var(--ks-mute) / <alpha-value>)",
          line: "rgb(var(--ks-line) / <alpha-value>)",
          tick: "rgb(var(--ks-tick) / <alpha-value>)",
          danger: "rgb(var(--ks-danger) / <alpha-value>)",
        },
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
        card: "0 1px 0.5px rgba(0,0,0,0.13)", // Kitchen Stream card/bubble rest shadow
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
