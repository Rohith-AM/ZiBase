import type { ColumnType } from "./model";
import { getLabelColor } from "./colors";

export { getLabelColor };

export function getTypeIcon(type: ColumnType): string {
  switch (type.kind) {
    case "toggle":
      return "⬜";
    case "select":
      return "▾";
    case "multi-select":
      return "🏷️";
    case "label":
      return "⬡";
    case "number":
      return "#";
    case "date":
      return "📅";
    case "formula":
      return "ƒ";
    default:
      return "T";
  }
}

export function showToast(message: string): void {
  const toast = createDiv();
  toast.className = "zibase-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add("zibase-toast-show"), 10);
  window.setTimeout(() => {
    toast.classList.remove("zibase-toast-show");
    window.setTimeout(() => toast.remove(), 300);
  }, 2500);
}

export function attachLinkTooltip(a: HTMLAnchorElement): void {
  let tooltip: HTMLElement | null = null;
  a.addEventListener("mouseenter", () => {
    tooltip = createDiv();
    tooltip.className = "zibase-link-tooltip";
    tooltip.textContent = "Alt+Click to edit";
    document.body.appendChild(tooltip);
    const rect = a.getBoundingClientRect();
    tooltip.setCssStyles({ top: `${rect.bottom + window.scrollY + 4}px` });
    tooltip.setCssStyles({ left: `${rect.left + window.scrollX}px` });
  });
  a.addEventListener("mouseleave", () => {
    tooltip?.remove();
    tooltip = null;
  });
}

export function startLabelEdit(
  chip: HTMLElement,
  current: string,
  onChange: (value: string) => Promise<void> | void,
): void {
  const input = createEl("input");
  input.className = "zibase-inline-input";
  input.value = current;
  chip.replaceWith(input);
  input.focus();
  input.select();
  const commit = async () => {
    const newVal = input.value.trim() || current;
    await onChange(newVal);
    chip.textContent = newVal;
    chip.setCssProps({ "--lc": getLabelColor(newVal) });
    input.replaceWith(chip);
  };
  input.addEventListener("blur", () => { void commit(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void commit();
    if (e.key === "Escape") input.replaceWith(chip);
  });
}
