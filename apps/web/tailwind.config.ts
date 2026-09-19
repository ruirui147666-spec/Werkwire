import type { Config } from "tailwindcss";

// Werkwire is light-mode only by product decision (see spec: "day light
// mode... sem night light mode"). There is deliberately no `dark:` variant
// wiring here — we don't want `prefers-color-scheme` to ever repaint the UI.
const config: Config = {
  darkMode: undefined,
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          900: "#12181F",
          700: "#2B3440",
          500: "#5B6675",
          300: "#9AA4B2",
          200: "#C7CFD8",
          100: "#E7EBEF",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F6F8FA",
          muted: "#EEF1F5",
        },
        brand: {
          50: "#EEF4FF",
          100: "#DCE8FF",
          300: "#8FB3FF",
          500: "#3D6FE0",
          600: "#2F58C4",
          700: "#24449C",
        },
        accent: {
          50: "#ECFBF5",
          300: "#7CDFB6",
          500: "#1FAE73",
          600: "#188F5F",
        },
        warn: {
          50: "#FFF7E8",
          300: "#F6C568",
          500: "#DB9A15",
        },
        danger: {
          50: "#FDECEC",
          300: "#F3A6A6",
          500: "#DC3B3B",
          600: "#B92E2E",
        },
      },
      borderRadius: {
        lg: "16px",
        xl: "20px",
        "2xl": "28px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(18,24,31,0.04), 0 8px 24px -8px rgba(18,24,31,0.10)",
        raised: "0 2px 8px rgba(18,24,31,0.08), 0 16px 40px -12px rgba(18,24,31,0.16)",
      },
      maxWidth: {
        app: "1180px",
        sheet: "480px",
      },
    },
  },
  plugins: [],
};

export default config;
