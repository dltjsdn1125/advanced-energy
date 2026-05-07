import type { Config } from "tailwindcss";

// White / Lime / Black only. Every shade beyond these three is an alpha
// variant of black so the rendered palette is strictly monochrome + lime.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: "#FFFFFF",
        black: "#000000",
        lime: {
          DEFAULT: "#C6F24A",
          soft: "rgba(198, 242, 74, 0.16)",
          ring: "rgba(198, 242, 74, 0.55)",
        },
        ink: {
          900: "#000000",
          700: "rgba(0, 0, 0, 0.72)",
          500: "rgba(0, 0, 0, 0.54)",
          400: "rgba(0, 0, 0, 0.40)",
          300: "rgba(0, 0, 0, 0.24)",
          200: "rgba(0, 0, 0, 0.12)",
          100: "rgba(0, 0, 0, 0.06)",
          50: "rgba(0, 0, 0, 0.03)",
        },
      },
      fontFamily: {
        sans: [
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        label: ["12px", { lineHeight: "16px", letterSpacing: "0.06em" }],
        spec: ["13px", { lineHeight: "20px" }],
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
      borderRadius: {
        card: "14px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.04), 0 6px 20px rgba(0, 0, 0, 0.05)",
        ring: "0 0 0 3px rgba(198, 242, 74, 0.55)",
      },
      maxWidth: {
        shell: "1480px",
      },
    },
  },
  plugins: [],
};

export default config;
