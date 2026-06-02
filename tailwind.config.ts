import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211f",
        paper: "#f7f4ed",
        mist: "#eef2ef",
        sage: "#6f877c",
        brass: "#b58b4a",
        clay: "#b86d54"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 33, 31, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
