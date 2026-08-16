import { describe, expect, it } from "vitest";
import { contrastRatio, DEFAULT_THEMES, getThemeContrastChecks, getThemeIconContrast } from "@/contexts/AppThemeContext";

describe("global application themes", () => {
  it.each(DEFAULT_THEMES)("keeps $name readable on every core surface", (theme) => {
    const checks = getThemeContrastChecks(theme);
    expect(checks.text).toBeGreaterThanOrEqual(4.5);
    expect(checks.muted).toBeGreaterThanOrEqual(4.5);
    expect(checks.accentOnBackground).toBeGreaterThanOrEqual(4.5);
    expect(checks.accentForeground).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.text, theme.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("includes the cream, navy, gold and white preset", () => {
    const theme = DEFAULT_THEMES.find((item) => item.id === "cream-navy-gold");
    expect(theme).toMatchObject({ background: "#ebe8e1", surface: "#ffffff", text: "#0b2345", accent: "#805d00", accentAlt: "#0b356d" });
  });
});

it.each(DEFAULT_THEMES)("keeps semantic icons visible on every surface in $name", (theme) => {
  const result = getThemeIconContrast(theme);
  expect(result.background).toBeGreaterThanOrEqual(3);
  expect(result.surface).toBeGreaterThanOrEqual(3);
  expect(result.elevated).toBeGreaterThanOrEqual(3);
});
