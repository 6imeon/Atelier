import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: "#0A0A0F",
          surface: "#0D0D14",
          card: "#1a1a25",
          yellow: "#E8FF59",
          cyan: "#59FFD2",
          purple: "#C59FFF",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
