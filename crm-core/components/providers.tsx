"use client";
import { ThemeProvider } from "next-themes";

/**
 * Dark mode is pinned off until it is actually built.
 *
 * The theming was only ever finished on the shell — header, page background, banners, the
 * KPI and filter bars. The funnel itself still paints its columns and cards with inline hex
 * (`KanbanColumn.tsx`, `DealCard.tsx`), which cannot carry a `dark:` variant at all, and
 * roughly forty more hardcoded light surfaces and dark text colours remain across clients,
 * calendar, stats and settings. Left on `system`, every customer whose OS is dark was served
 * white cards on a black page.
 *
 * `forcedTheme` rather than `defaultTheme`, because it also overrides a "dark" already
 * persisted in localStorage by someone who used the old Apariencia toggle. Remove it — and
 * restore the toggle in `features/branding/components/branding-settings.tsx` — once the
 * remaining surfaces are theme-aware.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
