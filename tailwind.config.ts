import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0A2540",
          light: "#0B2545",
        },
        teal: {
          DEFAULT: "#00A88F",
          light: "#00C9A7",
        },
        canvas: {
          DEFAULT: "#F8FAFC",
          alt: "#F1F5F9",
        },
        surface: "#FFFFFF",
        border: "#E2E8F0",
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
