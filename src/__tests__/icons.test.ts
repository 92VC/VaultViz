import { describe, it, expect } from "vitest";

import {
  icon,
  themeIcon,
  ICON_NAMES,
  type IconName,
  type ThemeState,
} from "../ui/icons";

// Toutes les icônes attendues par la story T1.2 (Wave 1).
const REQUIRED: IconName[] = [
  "euro",
  "margin",
  "target",
  "gauge",
  "check",
  "open",
  "export",
  "settings",
  "search",
  "close",
  "plus",
  "file",
  "drop",
  "warning",
];

const THEMES: ThemeState[] = ["light", "dark"];

describe("icon()", () => {
  it("expose toutes les icônes minimales requises", () => {
    for (const name of REQUIRED) {
      expect(ICON_NAMES).toContain(name);
    }
  });

  it.each(ICON_NAMES)("'%s' renvoie un SVG non vide bien formé", (name) => {
    const svg = icon(name);
    expect(svg).toBeTruthy();
    expect(svg.length).toBeGreaterThan(0);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox");
  });
});

describe("themeIcon()", () => {
  it.each(THEMES)("'%s' renvoie un SVG non vide bien formé", (state) => {
    const svg = themeIcon(state);
    expect(svg).toBeTruthy();
    expect(svg.length).toBeGreaterThan(0);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox");
  });

  it("renvoie un markup différent selon l'état clair / sombre", () => {
    expect(themeIcon("light")).not.toBe(themeIcon("dark"));
  });
});
