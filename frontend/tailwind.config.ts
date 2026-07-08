import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1360px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Cascadia Code", "Menlo", "Consolas", "monospace"],
        display: ["var(--font-display)", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          secondary: "var(--ink-secondary)",
          tertiary: "var(--ink-tertiary)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          weak: "var(--brand-weak)",
        },
        success: {
          DEFAULT: "var(--success)",
          weak: "var(--success-weak)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          weak: "var(--warning-weak)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          weak: "var(--danger-weak)",
        },
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
        metric: ["32px", { lineHeight: "36px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "metric-lg": ["48px", { lineHeight: "52px", letterSpacing: "-0.015em", fontWeight: "600" }],
        hero: ["clamp(40px,5.5vw,64px)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.15s ease-out",
        "accordion-up": "accordion-up 0.15s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-up": "fade-up 0.25s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
