import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Funnel (embudo) responsive tiers. All four live under theme.extend so the default
      // Tailwind screens (sm/md/lg/xl/2xl) survive for the rest of the app.
      //
      // Order matters here beyond readability: Tailwind emits every DEFAULT screen's media
      // query before any EXTENDED screen's, regardless of pixel value, and it emits extended
      // screens in the order they're declared in this object. That means an extended screen
      // and a default screen (e.g. `lg:`) can end up fighting over source order at the same
      // property — verified by building this exact config and diffing the generated CSS.
      // The fix used throughout the pipeline feature is to never mix: any property whose
      // value changes at one of these tier lines uses ONLY `tablet:`/`board:`/`short:`/
      // `tall:`, never `md:`/`lg:`, so the cascade order this object encodes is the only
      // one in play.
      screens: {
        // Phone -> tablet-portrait switch. Below this, the funnel stays the one-stage
        // carousel it is today.
        tablet: "520px",
        // Tablet-portrait -> full board switch. Same pixel value as Tailwind's default
        // `lg`, but declared here (after `tablet`) so it always wins over it in the
        // generated CSS — see note above.
        board: "1024px",
        // Short viewport (the Galaxy Tab A9 in landscape: 893x533 CSS px — narrower than
        // `board`, so width alone can't gate this). Used on its own to compact the header
        // chrome whenever height is scarce, independent of width tier.
        short: { raw: "(max-height: 600px)" },
        // Complement of `short`, used only as `board:tall:` to mean "true desktop": full
        // width AND normal height. That is the only state where the pre-tiers desktop
        // chrome (inline filters, inline new-deal/print buttons) should render unchanged.
        tall: { raw: "(min-height: 601px)" },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "Segoe UI", "sans-serif"],
      },
      keyframes: {
        sfPing: {
          "75%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
      animation: {
        sfPing: "sfPing 1.2s cubic-bezier(0,0,0.2,1) infinite",
      },
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
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
