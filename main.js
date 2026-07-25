var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main.ts
var import_obsidian2 = __toESM(require("obsidian"));
var main_exports = {};
__export(main_exports, {
  default: () => ZiBasePlugin
});
module.exports = __toCommonJS(main_exports);
var DEFAULT_SETTINGS = {
  renderInReadingView: true,
  inferSchema: true,
  columnRules: [...DEFAULT_COLUMN_RULES]
};
var ZiBasePlugin = class extends import_obsidian2.Plugin {
  async onload() {
    console.log("ZiBase v1.0.0 loaded \u2014 \u0BB4\u0BBF\u0BAF\u0BB2\u0BCD");
    await this.loadSettings();
    this.renderer = new ZiBaseTableRenderer(this.app, this);
    if (this.settings.renderInReadingView) {
      this.registerMarkdownPostProcessor((element, context) => {
        this.renderer.processReadingView(element, context);
      });
    }
    this.addCommand({
      id: "insert-table",
      name: "Insert annotated table",
      editorCallback: (editor) => {
        const template = [
          "| Name | Status | Priority | Tags |",
          "|------|--------|----------|------|",
          "| <!-- zibase: text --> | <!-- zibase: toggle --> | <!-- zibase: select:Low,Medium,High --> | <!-- zibase: label --> |",
          "| Item 1 | true | High | biology |",
          "| Item 2 | false | Low | chemistry |"
        ].join("\n");
        editor.replaceSelection(template);
      }
    });
    this.addCommand({
      id: "insert-plain-table",
      name: "Insert plain table (auto-inferred)",
      editorCallback: (editor) => {
        const template = [
          "| Name | Done | Score | Category |",
          "|------|------|-------|----------|",
          "| Task A | true | 90 | Work |",
          "| Task B | false | 75 | Work |",
          "| Task C | true | 82 | Personal |"
        ].join("\n");
        editor.replaceSelection(template);
      }
    });
    this.addCommand({
      id: "insert-formula-table",
      name: "Insert table with formula column",
      editorCallback: (editor) => {
        const template = [
          "| Item | Price | Qty | Total |",
          "|------|-------|-----|-------|",
          "| <!-- zibase: text --> | <!-- zibase: number --> | <!-- zibase: number --> | <!-- zibase: formula:Price * Qty --> |",
          "| Pen | 10 | 5 |  |",
          "| Book | 250 | 2 |  |",
          "| Eraser | 5 | 10 |  |"
        ].join("\n");
        editor.replaceSelection(template);
      }
    });
    this.addSettingTab(new ZiBaseSettingTab(this.app, this));
  }
  onunload() {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.columnRules || this.settings.columnRules.length === 0) {
      this.settings.columnRules = [...DEFAULT_COLUMN_RULES];
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var ZiBaseSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "ZiBase \u2014 \u0BB4\u0BBF\u0BAF\u0BB2\u0BCD" });
    containerEl.createEl("p", {
      text: "Markdown tables as living databases.",
      cls: "zibase-settings-desc"
    });
    containerEl.createEl("h3", { text: "\u2699\uFE0F General" });
    new import_obsidian2.Setting(containerEl).setName("Render in Reading View").setDesc("Show rich UI when viewing notes in reading mode.").addToggle((t) => t.setValue(this.plugin.settings.renderInReadingView).onChange(async (v) => {
      this.plugin.settings.renderInReadingView = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Auto-infer schema").setDesc("Automatically detect column types from plain markdown tables.").addToggle((t) => t.setValue(this.plugin.settings.inferSchema).onChange(async (v) => {
      this.plugin.settings.inferSchema = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "\u{1F3F7}\uFE0F Column Name Rules" });
    containerEl.createEl("p", {
      text: "When a column name matches, auto-assign that type. Applied to all inferred tables.",
      cls: "zibase-settings-desc"
    });
    const rulesContainer = containerEl.createDiv("zibase-rules-container");
    this.renderRules(rulesContainer);
    new import_obsidian2.Setting(containerEl).addButton((btn) => btn.setButtonText("+ Add rule").setCta().onClick(async () => {
      this.plugin.settings.columnRules.push({ name: "", type: "label" });
      await this.plugin.saveSettings();
      this.renderRules(rulesContainer);
    }));
    new import_obsidian2.Setting(containerEl).setName("Reset to defaults").setDesc("Restore the original column name rules.").addButton((btn) => btn.setButtonText("Reset").setWarning().onClick(async () => {
      this.plugin.settings.columnRules = [...DEFAULT_COLUMN_RULES];
      await this.plugin.saveSettings();
      this.renderRules(rulesContainer);
    }));
    containerEl.createEl("h3", { text: "\u2139\uFE0F About" });
    containerEl.createEl("p", { text: "ZiBase v1.0.0 \u2014 Built by Rohith A (ZIYAL)", cls: "zibase-settings-desc" });
    containerEl.createEl("p", { text: "Markdown-native database plugin for Obsidian.", cls: "zibase-settings-desc" });
  }
  renderRules(container) {
    container.empty();
    const TYPE_OPTIONS = ["text", "toggle", "select", "label", "number", "date", "formula"];
    this.plugin.settings.columnRules.forEach((rule, idx) => {
      const row = container.createDiv("zibase-rule-row");
      const nameInput = row.createEl("input", { type: "text", cls: "zibase-rule-name", value: rule.name });
      nameInput.placeholder = "column name";
      nameInput.addEventListener("change", async () => {
        this.plugin.settings.columnRules[idx].name = nameInput.value.trim();
        await this.plugin.saveSettings();
      });
      row.createSpan({ text: "\u2192", cls: "zibase-rule-arrow" });
      const typeSelect = row.createEl("select", { cls: "zibase-rule-type" });
      TYPE_OPTIONS.forEach((t) => {
        const opt = typeSelect.createEl("option", { text: t, value: t });
        if (t === rule.type)
          opt.selected = true;
      });
      typeSelect.addEventListener("change", async () => {
        this.plugin.settings.columnRules[idx].type = typeSelect.value;
        await this.plugin.saveSettings();
      });
      const removeBtn = row.createEl("button", { text: "\xD7", cls: "zibase-rule-remove" });
      removeBtn.addEventListener("click", async () => {
        this.plugin.settings.columnRules.splice(idx, 1);
        await this.plugin.saveSettings();
        this.renderRules(container);
      });
    });
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIlxubGV0IG1haW5fZXhwb3J0cyA9IHt9O1xuX19leHBvcnQobWFpbl9leHBvcnRzLCB7XG4gIGRlZmF1bHQ6ICgpID0+IFppQmFzZVBsdWdpblxufSk7XG5tb2R1bGUuZXhwb3J0cyA9IF9fdG9Db21tb25KUyhtYWluX2V4cG9ydHMpO1xuaW1wb3J0ICogYXMgaW1wb3J0X29ic2lkaWFuMiBmcm9tIFwib2JzaWRpYW5cIjtcblxuXG5sZXQgREVGQVVMVF9TRVRUSU5HUyA9IHtcbiAgcmVuZGVySW5SZWFkaW5nVmlldzogdHJ1ZSxcbiAgaW5mZXJTY2hlbWE6IHRydWUsXG4gIGNvbHVtblJ1bGVzOiBbLi4uREVGQVVMVF9DT0xVTU5fUlVMRVNdXG59O1xubGV0IFppQmFzZVBsdWdpbiA9IGNsYXNzIGV4dGVuZHMgaW1wb3J0X29ic2lkaWFuMi5QbHVnaW4ge1xuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgY29uc29sZS5sb2coXCJaaUJhc2UgdjEuMC4wIGxvYWRlZCBcXHUyMDE0IFxcdTBCQjRcXHUwQkJGXFx1MEJBRlxcdTBCQjJcXHUwQkNEXCIpO1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgdGhpcy5yZW5kZXJlciA9IG5ldyBaaUJhc2VUYWJsZVJlbmRlcmVyKHRoaXMuYXBwLCB0aGlzKTtcbiAgICBpZiAodGhpcy5zZXR0aW5ncy5yZW5kZXJJblJlYWRpbmdWaWV3KSB7XG4gICAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Qb3N0UHJvY2Vzc29yKChlbGVtZW50LCBjb250ZXh0KSA9PiB7XG4gICAgICAgIHRoaXMucmVuZGVyZXIucHJvY2Vzc1JlYWRpbmdWaWV3KGVsZW1lbnQsIGNvbnRleHQpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtdGFibGVcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IGFubm90YXRlZCB0YWJsZVwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3IpID0+IHtcbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBbXG4gICAgICAgICAgXCJ8IE5hbWUgfCBTdGF0dXMgfCBQcmlvcml0eSB8IFRhZ3MgfFwiLFxuICAgICAgICAgIFwifC0tLS0tLXwtLS0tLS0tLXwtLS0tLS0tLS0tfC0tLS0tLXxcIixcbiAgICAgICAgICBcInwgPCEtLSB6aWJhc2U6IHRleHQgLS0+IHwgPCEtLSB6aWJhc2U6IHRvZ2dsZSAtLT4gfCA8IS0tIHppYmFzZTogc2VsZWN0OkxvdyxNZWRpdW0sSGlnaCAtLT4gfCA8IS0tIHppYmFzZTogbGFiZWwgLS0+IHxcIixcbiAgICAgICAgICBcInwgSXRlbSAxIHwgdHJ1ZSB8IEhpZ2ggfCBiaW9sb2d5IHxcIixcbiAgICAgICAgICBcInwgSXRlbSAyIHwgZmFsc2UgfCBMb3cgfCBjaGVtaXN0cnkgfFwiXG4gICAgICAgIF0uam9pbihcIlxcblwiKTtcbiAgICAgICAgZWRpdG9yLnJlcGxhY2VTZWxlY3Rpb24odGVtcGxhdGUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtcGxhaW4tdGFibGVcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IHBsYWluIHRhYmxlIChhdXRvLWluZmVycmVkKVwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3IpID0+IHtcbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBbXG4gICAgICAgICAgXCJ8IE5hbWUgfCBEb25lIHwgU2NvcmUgfCBDYXRlZ29yeSB8XCIsXG4gICAgICAgICAgXCJ8LS0tLS0tfC0tLS0tLXwtLS0tLS0tfC0tLS0tLS0tLS18XCIsXG4gICAgICAgICAgXCJ8IFRhc2sgQSB8IHRydWUgfCA5MCB8IFdvcmsgfFwiLFxuICAgICAgICAgIFwifCBUYXNrIEIgfCBmYWxzZSB8IDc1IHwgV29yayB8XCIsXG4gICAgICAgICAgXCJ8IFRhc2sgQyB8IHRydWUgfCA4MiB8IFBlcnNvbmFsIHxcIlxuICAgICAgICBdLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKHRlbXBsYXRlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiaW5zZXJ0LWZvcm11bGEtdGFibGVcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IHRhYmxlIHdpdGggZm9ybXVsYSBjb2x1bW5cIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gW1xuICAgICAgICAgIFwifCBJdGVtIHwgUHJpY2UgfCBRdHkgfCBUb3RhbCB8XCIsXG4gICAgICAgICAgXCJ8LS0tLS0tfC0tLS0tLS18LS0tLS18LS0tLS0tLXxcIixcbiAgICAgICAgICBcInwgPCEtLSB6aWJhc2U6IHRleHQgLS0+IHwgPCEtLSB6aWJhc2U6IG51bWJlciAtLT4gfCA8IS0tIHppYmFzZTogbnVtYmVyIC0tPiB8IDwhLS0gemliYXNlOiBmb3JtdWxhOlByaWNlICogUXR5IC0tPiB8XCIsXG4gICAgICAgICAgXCJ8IFBlbiB8IDEwIHwgNSB8ICB8XCIsXG4gICAgICAgICAgXCJ8IEJvb2sgfCAyNTAgfCAyIHwgIHxcIixcbiAgICAgICAgICBcInwgRXJhc2VyIHwgNSB8IDEwIHwgIHxcIlxuICAgICAgICBdLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKHRlbXBsYXRlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFppQmFzZVNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICBcbiAgfVxuICBvbnVubG9hZCgpIHtcbiAgICBcbiAgfVxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLmNvbHVtblJ1bGVzIHx8IHRoaXMuc2V0dGluZ3MuY29sdW1uUnVsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnNldHRpbmdzLmNvbHVtblJ1bGVzID0gWy4uLkRFRkFVTFRfQ09MVU1OX1JVTEVTXTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn07XG5sZXQgWmlCYXNlU2V0dGluZ1RhYiA9IGNsYXNzIGV4dGVuZHMgaW1wb3J0X29ic2lkaWFuMi5QbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoYXBwLCBwbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cbiAgZGlzcGxheSgpIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiWmlCYXNlIFxcdTIwMTQgXFx1MEJCNFxcdTBCQkZcXHUwQkFGXFx1MEJCMlxcdTBCQ0RcIiB9KTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgdGV4dDogXCJNYXJrZG93biB0YWJsZXMgYXMgbGl2aW5nIGRhdGFiYXNlcy5cIixcbiAgICAgIGNsczogXCJ6aWJhc2Utc2V0dGluZ3MtZGVzY1wiXG4gICAgfSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwiXFx1MjY5OVxcdUZFMEYgR2VuZXJhbFwiIH0pO1xuICAgIG5ldyBpbXBvcnRfb2JzaWRpYW4yLlNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJSZW5kZXIgaW4gUmVhZGluZyBWaWV3XCIpLnNldERlc2MoXCJTaG93IHJpY2ggVUkgd2hlbiB2aWV3aW5nIG5vdGVzIGluIHJlYWRpbmcgbW9kZS5cIikuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnJlbmRlckluUmVhZGluZ1ZpZXcpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZW5kZXJJblJlYWRpbmdWaWV3ID0gdjtcbiAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH0pKTtcbiAgICBuZXcgaW1wb3J0X29ic2lkaWFuMi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiQXV0by1pbmZlciBzY2hlbWFcIikuc2V0RGVzYyhcIkF1dG9tYXRpY2FsbHkgZGV0ZWN0IGNvbHVtbiB0eXBlcyBmcm9tIHBsYWluIG1hcmtkb3duIHRhYmxlcy5cIikuYWRkVG9nZ2xlKCh0KSA9PiB0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmluZmVyU2NoZW1hKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5mZXJTY2hlbWEgPSB2O1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfSkpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIlxcdXsxRjNGN31cXHVGRTBGIENvbHVtbiBOYW1lIFJ1bGVzXCIgfSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgIHRleHQ6IFwiV2hlbiBhIGNvbHVtbiBuYW1lIG1hdGNoZXMsIGF1dG8tYXNzaWduIHRoYXQgdHlwZS4gQXBwbGllZCB0byBhbGwgaW5mZXJyZWQgdGFibGVzLlwiLFxuICAgICAgY2xzOiBcInppYmFzZS1zZXR0aW5ncy1kZXNjXCJcbiAgICB9KTtcbiAgICBjb25zdCBydWxlc0NvbnRhaW5lciA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdihcInppYmFzZS1ydWxlcy1jb250YWluZXJcIik7XG4gICAgdGhpcy5yZW5kZXJSdWxlcyhydWxlc0NvbnRhaW5lcik7XG4gICAgbmV3IGltcG9ydF9vYnNpZGlhbjIuU2V0dGluZyhjb250YWluZXJFbCkuYWRkQnV0dG9uKChidG4pID0+IGJ0bi5zZXRCdXR0b25UZXh0KFwiKyBBZGQgcnVsZVwiKS5zZXRDdGEoKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLnB1c2goeyBuYW1lOiBcIlwiLCB0eXBlOiBcImxhYmVsXCIgfSk7XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIHRoaXMucmVuZGVyUnVsZXMocnVsZXNDb250YWluZXIpO1xuICAgIH0pKTtcbiAgICBuZXcgaW1wb3J0X29ic2lkaWFuMi5TZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiUmVzZXQgdG8gZGVmYXVsdHNcIikuc2V0RGVzYyhcIlJlc3RvcmUgdGhlIG9yaWdpbmFsIGNvbHVtbiBuYW1lIHJ1bGVzLlwiKS5hZGRCdXR0b24oKGJ0bikgPT4gYnRuLnNldEJ1dHRvblRleHQoXCJSZXNldFwiKS5zZXRXYXJuaW5nKCkub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcyA9IFsuLi5ERUZBVUxUX0NPTFVNTl9SVUxFU107XG4gICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIHRoaXMucmVuZGVyUnVsZXMocnVsZXNDb250YWluZXIpO1xuICAgIH0pKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJcXHUyMTM5XFx1RkUwRiBBYm91dFwiIH0pO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7IHRleHQ6IFwiWmlCYXNlIHYxLjAuMCBcXHUyMDE0IEJ1aWx0IGJ5IFJvaGl0aCBBIChaSVlBTClcIiwgY2xzOiBcInppYmFzZS1zZXR0aW5ncy1kZXNjXCIgfSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogXCJNYXJrZG93bi1uYXRpdmUgZGF0YWJhc2UgcGx1Z2luIGZvciBPYnNpZGlhbi5cIiwgY2xzOiBcInppYmFzZS1zZXR0aW5ncy1kZXNjXCIgfSk7XG4gIH1cbiAgcmVuZGVyUnVsZXMoY29udGFpbmVyKSB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgY29uc3QgVFlQRV9PUFRJT05TID0gW1widGV4dFwiLCBcInRvZ2dsZVwiLCBcInNlbGVjdFwiLCBcImxhYmVsXCIsIFwibnVtYmVyXCIsIFwiZGF0ZVwiLCBcImZvcm11bGFcIl07XG4gICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXMuZm9yRWFjaCgocnVsZSwgaWR4KSA9PiB7XG4gICAgICBjb25zdCByb3cgPSBjb250YWluZXIuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGUtcm93XCIpO1xuICAgICAgY29uc3QgbmFtZUlucHV0ID0gcm93LmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcInRleHRcIiwgY2xzOiBcInppYmFzZS1ydWxlLW5hbWVcIiwgdmFsdWU6IHJ1bGUubmFtZSB9KTtcbiAgICAgIG5hbWVJbnB1dC5wbGFjZWhvbGRlciA9IFwiY29sdW1uIG5hbWVcIjtcbiAgICAgIG5hbWVJbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS5uYW1lID0gbmFtZUlucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICB9KTtcbiAgICAgIHJvdy5jcmVhdGVTcGFuKHsgdGV4dDogXCJcXHUyMTkyXCIsIGNsczogXCJ6aWJhc2UtcnVsZS1hcnJvd1wiIH0pO1xuICAgICAgY29uc3QgdHlwZVNlbGVjdCA9IHJvdy5jcmVhdGVFbChcInNlbGVjdFwiLCB7IGNsczogXCJ6aWJhc2UtcnVsZS10eXBlXCIgfSk7XG4gICAgICBUWVBFX09QVElPTlMuZm9yRWFjaCgodCkgPT4ge1xuICAgICAgICBjb25zdCBvcHQgPSB0eXBlU2VsZWN0LmNyZWF0ZUVsKFwib3B0aW9uXCIsIHsgdGV4dDogdCwgdmFsdWU6IHQgfSk7XG4gICAgICAgIGlmICh0ID09PSBydWxlLnR5cGUpXG4gICAgICAgICAgb3B0LnNlbGVjdGVkID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgICAgdHlwZVNlbGVjdC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS50eXBlID0gdHlwZVNlbGVjdC52YWx1ZTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHJlbW92ZUJ0biA9IHJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXFx4RDdcIiwgY2xzOiBcInppYmFzZS1ydWxlLXJlbW92ZVwiIH0pO1xuICAgICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJSdWxlcyhjb250YWluZXIpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn07XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFNQSx1QkFBa0M7QUFMbEMsSUFBSSxlQUFlLENBQUM7QUFDcEIsU0FBUyxjQUFjO0FBQUEsRUFDckIsU0FBUyxNQUFN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
