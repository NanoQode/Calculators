// Design tokens lifted verbatim from the four supplied page designs
// (content/data/design-*.html), so compiled pages match them exactly.
// Compiled at build time instead of the Tailwind CDN script the designs use:
// the CDN script is render-blocking and ~100 KB of JS on every page.
module.exports = {
  content: ["./dist/**/*.html", "./src/site.js"],
  theme: {
    extend: {
      colors: {
        "on-surface-variant": "#44474c", "primary-fixed": "#d6e3fe", "secondary-fixed": "#cce5ff",
        "surface-container-lowest": "#ffffff", surface: "#f8f9ff", "navy-surface": "#132742",
        "primary-fixed-dim": "#bac7e1", "canvas-light": "#F8FAFC", "on-tertiary-fixed-variant": "#93000b",
        "on-surface": "#0b1c30", "navy-darkest": "#070E18", "on-tertiary": "#ffffff",
        "inverse-on-surface": "#eaf1ff", "on-secondary-fixed-variant": "#004b73",
        "surface-container-highest": "#d3e4fe", "surface-container": "#e5eeff", "on-background": "#0b1c30",
        "secondary-container": "#5bb8fe", "on-primary-fixed-variant": "#3a475c", "primary-container": "#0e1c2f",
        "on-primary-fixed": "#0e1c2f", error: "#ba1a1a", "secondary-fixed-dim": "#93ccff",
        "surface-variant": "#d3e4fe", "surface-bright": "#f8f9ff", "surface-dim": "#cbdbf5", "on-error": "#ffffff",
        background: "#f8f9ff", primary: "#000000", "tertiary-fixed": "#ffdad6", "sky-bright": "#38BDF8",
        "on-error-container": "#93000a", "on-primary-container": "#77849c", secondary: "#006398",
        outline: "#75777d", "sky-subtle": "#E0F2FE", "on-secondary-container": "#00476e",
        "surface-container-low": "#eff4ff", "maple-red": "#DC2626", "maple-red-hover": "#B91C1C", "surface-tint": "#525f75",
        "on-tertiary-fixed": "#410002", "tertiary-container": "#410002", "error-container": "#ffdad6",
        "maple-red-tint": "#FEF2F2", "outline-variant": "#c5c6cd", "on-primary": "#ffffff", "on-secondary": "#ffffff",
        "border-dark-subtle": "#1E3A5F", "on-tertiary-container": "#f63a35", "border-hairline": "#E2E8F0",
        "surface-container-high": "#dce9ff", tertiary: "#000000", "tertiary-fixed-dim": "#ffb4ab",
        "on-secondary-fixed": "#001d31", "inverse-surface": "#213145", "inverse-primary": "#bac7e1",
      },
      borderRadius: { DEFAULT: "0.125rem", lg: "0.25rem", xl: "0.5rem", "2xl": "0.75rem", full: "9999px" },
      spacing: {
        "space-lg": "1.5rem", gutter: "1rem", "space-sm": "0.5rem", "space-md": "1rem",
        "space-xl": "2.25rem", margin: "1.25rem", "space-xs": "0.25rem",
      },
      fontFamily: {
        serif: ['"Source Serif 4"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        "headline-md": ['"Source Serif 4"', "Georgia", "serif"], "headline-lg": ['"Source Serif 4"', "Georgia", "serif"],
        "display-hero": ['"Source Serif 4"', "Georgia", "serif"], "display-hero-mobile": ['"Source Serif 4"', "Georgia", "serif"],
        "label-caps": ["Inter", "system-ui", "sans-serif"], "label-md": ["Inter", "system-ui", "sans-serif"],
        "label-lg": ["Inter", "system-ui", "sans-serif"], "body-md": ["Inter", "system-ui", "sans-serif"],
        "body-sm": ["Inter", "system-ui", "sans-serif"], "body-lg": ["Inter", "system-ui", "sans-serif"],
        "headline-sm": ["Inter", "system-ui", "sans-serif"], "stat-metric": ["Inter", "system-ui", "sans-serif"],
        "stat-metric-mobile": ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "headline-md": ["22px", { lineHeight: "28px", fontWeight: "600" }],
        "label-caps": ["11px", { lineHeight: "14px", letterSpacing: "0.08em", fontWeight: "700" }],
        "display-hero": ["44px", { lineHeight: "52px", fontWeight: "700" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.04em", fontWeight: "600" }],
        "body-md": ["15px", { lineHeight: "24px", fontWeight: "400" }],
        "display-hero-mobile": ["30px", { lineHeight: "38px", fontWeight: "700" }],
        "body-sm": ["13px", { lineHeight: "20px", fontWeight: "400" }],
        "label-lg": ["14px", { lineHeight: "18px", letterSpacing: "0.01em", fontWeight: "600" }],
        "headline-sm": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "stat-metric": ["32px", { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["30px", { lineHeight: "38px", fontWeight: "600" }],
        "body-lg": ["17px", { lineHeight: "28px", fontWeight: "400" }],
        "stat-metric-mobile": ["28px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "700" }],
      },
      maxWidth: { prose: "72ch" },
    },
  },
  plugins: [],
};
