import { describe, it, expect, vi } from "vitest";

import { renderWelcome } from "../components/welcome";

describe("renderWelcome", () => {
  it("appelle onOpen au clic sur le CTA", () => {
    const c = document.createElement("div");
    const onOpen = vi.fn();
    renderWelcome(c, { onOpen });
    c.querySelector<HTMLButtonElement>(".vv-welcome-open")!.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("mentionne l'astuce double-clic Explorateur", () => {
    const c = document.createElement("div");
    renderWelcome(c, { onOpen: () => {} });
    expect(c.textContent).toMatch(/double-clique/i);
  });
});
