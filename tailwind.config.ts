import type { Config } from "tailwindcss";

const token = (name: string) =>
  `rgb(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        panel: token("panel"),
        panelElevated: token("panel-elevated"),
        panelMuted: token("panel-muted"),
        line: token("line"),
        brand: token("brand"),
        brandStrong: token("brand-strong"),
        ink: token("ink"),
        inkSoft: token("ink-soft"),
        inkMuted: token("ink-muted"),
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
      },
      borderRadius: {
        card: "16px",
        control: "12px",
        chip: "999px",
      },
      boxShadow: {
        soft: "0 4px 24px rgb(0 0 0 / 0.35)",
        lifted: "0 8px 30px rgb(0 0 0 / 0.45)",
        glow: "0 0 20px rgb(245 181 68 / 0.18)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
