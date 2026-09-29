import { Modal, type App } from "obsidian";
import type { Column } from "./model";

export class SelectOptionsModal extends Modal {
  colName: string;
  currentOptions: string[];
  onSubmit: (options: string[]) => void;

  constructor(app: App, colName: string, currentOptions: string[], onSubmit: (options: string[]) => void) {
    super(app);
    this.colName = colName;
    this.currentOptions = [...currentOptions];
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("zibase-modal");
    contentEl.createEl("h3", { text: `Options for "${this.colName}"`, cls: "zibase-modal-title" });
    const chipsWrap = contentEl.createDiv("zibase-modal-chips");
    const renderChips = () => {
      chipsWrap.empty();
      this.currentOptions.forEach((opt, i) => {
        const chip = chipsWrap.createDiv("zibase-modal-chip");
        chip.createSpan({ text: opt });
        const x = chip.createSpan({ text: "×", cls: "zibase-chip-remove" });
        x.addEventListener("click", () => {
          this.currentOptions.splice(i, 1);
          renderChips();
        });
      });
    };
    renderChips();
    const inputRow = contentEl.createDiv("zibase-modal-input-row");
    const input = inputRow.createEl("input", { type: "text", cls: "zibase-modal-input" });
    input.placeholder = "Add option…";
    const addBtn = inputRow.createEl("button", { text: "Add", cls: "zibase-modal-add-btn" });
    const addOption = () => {
      const val = input.value.trim();
      if (val && !this.currentOptions.includes(val)) {
        this.currentOptions.push(val);
        renderChips();
        input.value = "";
        input.focus();
      }
    };
    addBtn.addEventListener("click", addOption);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addOption();
      }
      if (e.key === "Escape") this.close();
    });
    const applyBtn = contentEl.createEl("button", { text: "Apply", cls: "zibase-modal-apply-btn" });
    applyBtn.addEventListener("click", () => {
      if (this.currentOptions.length > 0) {
        this.onSubmit(this.currentOptions);
        this.close();
      }
    });
    window.setTimeout(() => input.focus(), 50);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class FormulaInputModal extends Modal {
  colName: string;
  currentExpr: string;
  columns: Column[];
  onSubmit: (expr: string) => void;

  constructor(
    app: App,
    colName: string,
    currentExpr: string,
    columns: Column[],
    onSubmit: (expr: string) => void,
  ) {
    super(app);
    this.colName = colName;
    this.currentExpr = currentExpr;
    this.columns = columns;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("zibase-modal");
    contentEl.createEl("h3", { text: `Formula for "${this.colName}"`, cls: "zibase-modal-title" });
    contentEl.createEl("p", {
      text: "Use column names to reference values. Case-insensitive.",
      cls: "zibase-settings-desc",
    });

    let input: HTMLInputElement;
    const colList = contentEl.createDiv("zibase-formula-cols");
    colList.createSpan({ text: "Available: ", cls: "zibase-formula-cols-label" });
    this.columns.forEach((col) => {
      if (col.name === this.colName) return;
      const chip = colList.createSpan({ text: col.name, cls: "zibase-formula-col-chip" });
      chip.addEventListener("click", () => {
        input.value += col.name;
        input.focus();
      });
    });

    input = contentEl.createEl("input", { type: "text", cls: "zibase-modal-input zibase-modal-formula-input" });
    input.value = this.currentExpr;
    input.placeholder = "e.g., Price * Qty";

    const applyBtn = contentEl.createEl("button", { text: "Apply", cls: "zibase-modal-apply-btn" });
    const apply = () => {
      const expr = input.value.trim();
      if (expr) {
        this.onSubmit(expr);
        this.close();
      }
    };
    applyBtn.addEventListener("click", apply);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        apply();
      }
      if (e.key === "Escape") this.close();
    });

    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
