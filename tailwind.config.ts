import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080808",
        "background-secondary": "#101010",
        surface: "#151515",
        "surface-hover": "#1C1C1C",
        "surface-border": "rgba(255, 255, 255, 0.08)",
        focus: {
          DEFAULT: "#FF6500",
          hover: "#FF7A1A",
          dark: "#E65B00",
          light: "#FF8E3C",
          glow: "rgba(255, 101, 0, 0.2)",
        },
        muted: {
          DEFAULT: "#A7A7A7",
          foreground: "#737373",
          light: "#F5F5F5",
        },
        border: "rgba(255, 255, 255, 0.08)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Display'",
          "'SF Pro Text'",
          "'SF Pro'",
          "'Helvetica Neue'",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        apple: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Display'",
          "'SF Pro Text'",
          "'SF Pro'",
          "sans-serif",
        ],
        heading: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Display'",
          "'SF Pro'",
          "sans-serif",
        ],
      },
      boxShadow: {
        focus: "0 0 25px rgba(255, 101, 0, 0.25)",
        "card-dark": "0 8px 30px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
