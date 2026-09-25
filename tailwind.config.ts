import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "rgb(var(--color-navy) / <alpha-value>)",
          light: "rgb(var(--color-navy-light) / <alpha-value>)",
        },
        teal: {
          DEFAULT: "rgb(var(--color-teal) / <alpha-value>)",
          light: "rgb(var(--color-teal-light) / <alpha-value>)",
        },
        canvas: {
          DEFAULT: "rgb(var(--color-canvas) / <alpha-value>)",
          alt: "rgb(var(--color-canvas-alt) / <alpha-value>)",
        },
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
