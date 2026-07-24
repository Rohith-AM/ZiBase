
var main_exports = {};
__export(main_exports, {
  default: () => ZiBasePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");


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
      id: "zibase-insert-table",
      name: "Insert ZiBase annotated table",
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
      id: "zibase-insert-plain-table",
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
      id: "zibase-insert-formula-table",
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
    console.log("ZiBase v1.0.0 ready.");
  }
  onunload() {
    console.log("ZiBase unloaded.");
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
