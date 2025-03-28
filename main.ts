import { App, Editor, MarkdownView, Menu, Modal, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';

export interface StickerPackageSettings {
    stickerFolder: string;
    defaultSize: number;
}

export const DEFAULT_SETTINGS: StickerPackageSettings = {
    stickerFolder: '',
    defaultSize: 50
};

export class StickerModal extends Modal {
    plugin: StickerPackagePlugin;
    stickerFiles: TFile[] = [];
    searchInput: HTMLInputElement;
    stickerContainer: HTMLElement;
    onChoose: (file: TFile) => void;

    constructor(app: App, plugin: StickerPackagePlugin, onChoose: (file: TFile) => void) {
        super(app);
        this.plugin = plugin;
        this.onChoose = onChoose;
    }

    async onOpen() {
        const { contentEl } = this;

        // 创建搜索框
        contentEl.addClass('sticker-package-modal');
        const searchContainer = contentEl.createDiv();
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: '搜索表情包...',
            cls: 'sticker-package-search'
        });
        this.searchInput.addEventListener('input', () => this.updateStickerList());

        // 创建表情包容器
        this.stickerContainer = contentEl.createDiv({ cls: 'sticker-package-grid' });

        // 加载表情包
        await this.loadStickers();
    }

    async loadStickers() {
        if (!this.plugin.settings.stickerFolder) {
            this.stickerContainer.createEl('div', { text: '请先在设置中选择表情包目录' });
            return;
        }

        const folder = this.app.vault.getAbstractFileByPath(this.plugin.settings.stickerFolder);
        if (!(folder instanceof TFolder)) {
            this.stickerContainer.createEl('div', { text: '无法加载表情包目录' });
            return;
        }

        this.stickerFiles = folder.children.filter(file => 
            file instanceof TFile && 
            ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(file.extension.toLowerCase())
        ) as TFile[];

        this.updateStickerList();
    }

    updateStickerList() {
        this.stickerContainer.empty();
        const searchTerm = this.searchInput.value.toLowerCase();

        const filteredStickers = this.stickerFiles.filter(file =>
            file.basename.toLowerCase().includes(searchTerm)
        );

        for (const file of filteredStickers) {
            const stickerItem = this.stickerContainer.createDiv({ cls: 'sticker-package-item' });
            const img = stickerItem.createEl('img', {
                cls: 'sticker-preview',
                attr: {
                    src: this.app.vault.getResourcePath(file),
                    alt: file.basename
                }
            });

            stickerItem.addEventListener('click', () => {
                this.onChoose(file);
                this.close();
            });

            stickerItem.createEl('div', {
                cls: 'sticker-name',
                text: file.basename
            });
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export default class StickerPackagePlugin extends Plugin {
	settings: StickerPackageSettings;

	async onload() {
		await this.loadSettings();

		// 注册设置页面
		this.addSettingTab(new StickerPackageSettingTab(this.app, this));

		// 注册编辑器上下文菜单
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				menu.addItem((item) => {
					item
						.setTitle('插入表情包')
						.setIcon('image')
						.onClick(async () => {
                            new StickerModal(this.app, this, (file) => {
                                const pos = editor.getCursor();
                                editor.replaceRange(`![[${file.path}|${this.settings.defaultSize}]]`, pos);
                            }).open();
						});
				});
			})
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export class StickerPackageSettingTab extends PluginSettingTab {
    plugin: StickerPackagePlugin;

    constructor(app: App, plugin: StickerPackagePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: '表情包设置' });

        new Setting(containerEl)
            .setName('表情包目录')
            .setDesc('选择存放表情包图片的目录')
            .addDropdown(dropdown => {
                const folders = this.app.vault.getAllLoadedFiles()
                    .filter((f: any) => f instanceof TFolder)
                    .map((f: any) => f.path);
                
                dropdown
                    .addOptions({'': '请选择目录', ...Object.fromEntries(folders.map((f: any) => [f, f]))}) 
                    .setValue(this.plugin.settings.stickerFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.stickerFolder = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('表情包默认尺寸')
            .setDesc('设置插入表情包时的默认尺寸（像素）')
            .addText(text => text
                .setPlaceholder('50')
                .setValue(String(this.plugin.settings.defaultSize))
                .onChange(async (value) => {
                    const size = parseInt(value) || 50;
                    this.plugin.settings.defaultSize = size;
                    await this.plugin.saveSettings();
                }));
    }
}
