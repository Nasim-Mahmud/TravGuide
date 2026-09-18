/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* ── Atlas design tokens (design.md §2) ─────────────────── */
        paper: {
          DEFAULT: "var(--paper)",
          raised: "var(--paper-raised)",
          sunken: "var(--paper-sunken)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
          faint: "var(--ink-faint)",
          panel: "var(--ink-panel)",
        },
        hairline: {
          DEFAULT: "var(--hairline)",
          strong: "var(--hairline-strong)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          foreground: "hsl(var(--accent-foreground))",
        },
        danger: "var(--danger)",
        state: {
          none: "var(--state-none-fill)",
          visited: "var(--state-visited)",
          "visited-stroke": "var(--state-visited-stroke)",
          lived: "var(--state-lived)",
          "lived-stroke": "var(--state-lived-stroke)",
          transit: "var(--state-transit)",
          "transit-stroke": "var(--state-transit-stroke)",
          wishlist: "var(--state-wishlist)",
          "wishlist-hatch": "var(--state-wishlist-hatch)",
          partial: "var(--state-partial)",
          "partial-stroke": "var(--state-partial-stroke)",
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(1.75rem, 4vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
        'title': ['1.25rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'body': ['0.9375rem', { lineHeight: '1.55' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5' }],
        'label': ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.08em' }],
        'stat-hero': ['clamp(3rem, 9vw, 6.5rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'stat-num': ['1.5rem', { lineHeight: '1.2' }],
        'mono-sm': ['0.75rem', { lineHeight: '1.4' }],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "20px",
        md: "14px",
        sm: "8px",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        'elev-1': '0 1px 2px rgba(34,30,23,.08), 0 2px 8px rgba(34,30,23,.06)',
        'elev-2': '0 2px 6px rgba(34,30,23,.08), 0 8px 24px rgba(34,30,23,.10)',
        'elev-3': '0 4px 12px rgba(34,30,23,.10), 0 16px 48px rgba(34,30,23,.14)',
        'region-hover': '0 2px 8px rgba(34,30,23,.18)',
        'region-selected': '0 0 0 3px rgba(181,122,31,.28), 0 2px 10px rgba(34,30,23,.20)',
      },
      transitionTimingFunction: {
        'atlas': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'atlas-move': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "atlas-fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "atlas-fade-down": {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "atlas-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "atlas-slide-left": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "atlas-slide-right-12": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "atlas-pulse-ring": {
          "0%": { opacity: "0.9", transform: "scale(0.5)" },
          "100%": { opacity: "0", transform: "scale(1.4)" },
        },
        "atlas-shimmer": {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        "atlas-spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "atlas-breath": {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.02)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "fade-up": "atlas-fade-up 250ms cubic-bezier(0.22,1,0.36,1) both",
        "fade-down": "atlas-fade-down 250ms cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "atlas-fade-in 200ms ease-out both",
        "slide-left": "atlas-slide-left 220ms cubic-bezier(0.22,1,0.36,1) both",
        "slide-right-12": "atlas-slide-right-12 200ms cubic-bezier(0.22,1,0.36,1) both",
        "pulse-ring": "atlas-pulse-ring 450ms ease-out both",
        "shimmer": "atlas-shimmer 900ms ease-in-out infinite",
        "spin-slow": "atlas-spin-slow 8s linear infinite",
        "breath": "atlas-breath 200ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
