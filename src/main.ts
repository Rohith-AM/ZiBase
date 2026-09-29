import { Plugin, PluginSettingTab, Setting, type App, type Editor } from "obsidian";
import { DEFAULT_COLUMN_RULES } from "./schema";
import { ZiBaseTableRenderer } from "./renderer";
import { COLUMN_TYPE_OPTIONS, type ColumnRule, type ZiBaseSettings } from "./model";
import { PLUGIN_VERSION } from "./version";

const DEFAULT_SETTINGS: ZiBaseSettings = {
  renderInReadingView: true,
  inferSchema: true,
  columnRules: [...DEFAULT_COLUMN_RULES],
};

export default class ZiBasePlugin extends Plugin {
  settings: ZiBaseSettings = DEFAULT_SETTINGS;
  renderer!: ZiBaseTableRenderer;

  async onload(): Promise<void> {
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
      editorCallback: (editor: Editor) => {
        const template = [
          "| Name | Status | Priority | Tags |",
          "|------|--------|----------|------|",
          "| <!-- zibase: text --> | <!-- zibase: toggle --> | <!-- zibase: select:Low,Medium,High --> | <!-- zibase: label --> |",
          "| Item 1 | true | High | biology |",
          "| Item 2 | false | Low | chemistry |",
        ].join("\n");
        editor.replaceSelection(template);
      },
    });
    this.addCommand({
      id: "insert-plain-table",
      name: "Insert plain table (auto-inferred)",
      editorCallback: (editor: Editor) => {
        const template = [
          "| Name | Done | Score | Category |",
          "|------|------|-------|----------|",
          "| Task A | true | 90 | Work |",
          "| Task B | false | 75 | Work |",
          "| Task C | true | 82 | Personal |",
        ].join("\n");
        editor.replaceSelection(template);
      },
    });
    this.addCommand({
      id: "insert-formula-table",
      name: "Insert table with formula column",
      editorCallback: (editor: Editor) => {
        const template = [
          "| Item | Price | Qty | Total |",
          "|------|-------|-----|-------|",
          "| <!-- zibase: text --> | <!-- zibase: number --> | <!-- zibase: number --> | <!-- zibase: formula:Price * Qty --> |",
          "| Pen | 10 | 5 |  |",
          "| Book | 250 | 2 |  |",
          "| Eraser | 5 | 10 |  |",
        ].join("\n");
        editor.replaceSelection(template);
      },
    });
    this.addSettingTab(new ZiBaseSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as ZiBaseSettings;
    if (!this.settings.columnRules || this.settings.columnRules.length === 0) {
      this.settings.columnRules = [...DEFAULT_COLUMN_RULES];
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class ZiBaseSettingTab extends PluginSettingTab {
  plugin: ZiBasePlugin;

  constructor(app: App, plugin: ZiBasePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("ZiBase — ழியல்").setHeading();
    containerEl.createEl("p", {
      text: "Markdown tables as living databases.",
      cls: "zibase-settings-desc",
    });
    new Setting(containerEl).setName("General").setHeading();
    new Setting(containerEl)
      .setName("Render in Reading View")
      .setDesc("Show rich UI when viewing notes in reading mode.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.renderInReadingView).onChange((v) => {
          void (async () => {
            this.plugin.settings.renderInReadingView = v;
            await this.plugin.saveSettings();
          })();
        }),
      );
    new Setting(containerEl)
      .setName("Auto-infer schema")
      .setDesc("Automatically detect column types from plain markdown tables. Turn off to only enhance annotated tables.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.inferSchema).onChange((v) => {
          void (async () => {
            this.plugin.settings.inferSchema = v;
            await this.plugin.saveSettings();
          })();
        }),
      );
    new Setting(containerEl).setName("Column name rules").setHeading();
    containerEl.createEl("p", {
      text: "When a column name matches, auto-assign that type. Applied to all inferred tables.",
      cls: "zibase-settings-desc",
    });
    const rulesContainer = containerEl.createDiv("zibase-rules-container");
    this.renderRules(rulesContainer);
    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("+ Add rule").setCta().onClick(() => {
        void (async () => {
          this.plugin.settings.columnRules.push({ name: "", type: "label" });
          await this.plugin.saveSettings();
          this.renderRules(rulesContainer);
        })();
      }),
    );
    new Setting(containerEl)
      .setName("Reset to defaults")
      .setDesc("Restore the original column name rules.")
      .addButton((btn) =>
        btn.setButtonText("Reset").setDestructive().onClick(() => {
          void (async () => {
            this.plugin.settings.columnRules = [...DEFAULT_COLUMN_RULES];
            await this.plugin.saveSettings();
            this.renderRules(rulesContainer);
          })();
        }),
      );
    new Setting(containerEl).setName("About").setHeading();
    containerEl.createEl("p", { text: `ZiBase v${PLUGIN_VERSION} — Built by Rohith A (ZIYAL)`, cls: "zibase-settings-desc" });
    containerEl.createEl("p", { text: "Markdown-native database plugin.", cls: "zibase-settings-desc" });
  }

  renderRules(container: HTMLElement): void {
    container.empty();
    this.plugin.settings.columnRules.forEach((rule: ColumnRule, idx: number) => {
      const row = container.createDiv("zibase-rule-row");
      const nameInput = row.createEl("input", { type: "text", cls: "zibase-rule-name", value: rule.name });
      nameInput.placeholder = "column name";
      nameInput.addEventListener("change", () => {
        void (async () => {
          this.plugin.settings.columnRules[idx].name = nameInput.value.trim();
          await this.plugin.saveSettings();
        })();
      });
      row.createSpan({ text: "→", cls: "zibase-rule-arrow" });
      const typeSelect = row.createEl("select", { cls: "zibase-rule-type" });
      COLUMN_TYPE_OPTIONS.forEach((t) => {
        const opt = typeSelect.createEl("option", { text: t, value: t });
        if (t === rule.type) opt.selected = true;
      });
      typeSelect.addEventListener("change", () => {
        void (async () => {
          this.plugin.settings.columnRules[idx].type = typeSelect.value;
          await this.plugin.saveSettings();
        })();
      });
      const removeBtn = row.createEl("button", { text: "×", cls: "zibase-rule-remove" });
      removeBtn.addEventListener("click", () => {
        void (async () => {
          this.plugin.settings.columnRules.splice(idx, 1);
          await this.plugin.saveSettings();
          this.renderRules(container);
        })();
      });
    });
  }
}
