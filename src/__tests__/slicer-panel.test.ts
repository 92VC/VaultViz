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

  it("cocher puis décocher → onChange([])", () => {
    const el = document.createElement("div");
    const onChange = vi.fn();
    renderSlicerPanel(el, { label: "G", values: ["43"], selected: [], onChange });
    const box = el.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(["43"]);
    box.checked = false;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("selected pré-coché → case cochée au rendu initial", () => {
    const el = document.createElement("div");
    renderSlicerPanel(el, {
      label: "G",
      values: ["43", "58"],
      selected: ["43"],
      onChange: vi.fn(),
    });
    const boxes = el.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect(boxes[0].checked).toBe(true);
    expect(boxes[1].checked).toBe(false);
  });
});
