import { describe, it, expect, vi } from "vitest";
import { renderSlicerPanel } from "../components/slicer-panel";
describe("slicer-panel", () => {
  it("rend une case par valeur et émet la sélection au clic", () => {
    const el = document.createElement("div");
    const onChange = vi.fn();
    renderSlicerPanel(el, { label: "Gestion", values: ["43", "58", "85"], selected: [], onChange });
    const boxes = el.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect(boxes.length).toBe(3);
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(["43"]);
  });
});
