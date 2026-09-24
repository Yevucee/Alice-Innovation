import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#faf9f7",
        ink: "#141414",
        muted: "#5c5c5c",
        line: "#e8e4de",
        accent: "#1f4d3a",
        "accent-soft": "#e8f0eb",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(20, 20, 20, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
