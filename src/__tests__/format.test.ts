import { describe, it, expect } from "vitest";
import { eurC, eurFull, pct, signed, number, fmt } from "../ui/format";

describe("format", () => {
  it("eurC compacte M€/k€/€", () => {
    expect(eurC(1_200_000)).toContain("M€");
    expect(eurC(340_000)).toContain("k€");
    expect(eurC(980)).toContain("€");
  });

  it("eurFull groupe les milliers", () => {
    expect(eurFull(1234567)).toContain("€");
    expect(eurFull(1234567)).toMatch(/1.234.567/);
  });

  it("pct ajoute le symbole et 1 décimale par défaut", () => {
    expect(pct(12.3)).toMatch(/12,3\s*%/);
  });

  it("signed préfixe le signe", () => {
    expect(signed(3.2).startsWith("+")).toBe(true);
    expect(signed(-1.5).startsWith("-")).toBe(true);
  });

  it("number groupe les entiers", () => {
    expect(number(1234)).toMatch(/1.234/);
  });

  it("fmt dispatche selon le kind", () => {
    expect(fmt(1_200_000, "eur")).toContain("M€");
    expect(fmt(12.3, "pct")).toContain("%");
    expect(fmt(3.2, "signed").startsWith("+")).toBe(true);
    expect(fmt(1234, "number")).toMatch(/1.234/);
    expect(fmt(1234, undefined)).toMatch(/1.234/);
  });
});
