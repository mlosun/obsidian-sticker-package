// 从Obsidian导入必要的模块
import { App, Editor, MarkdownView, Menu, Modal, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';

// 表情包插件设置接口
// stickerFolder: 表情包文件夹路径
// defaultSize: 默认插入表情包的尺寸
export interface StickerPackageSettings {
    stickerFolder: string;
    defaultSize: number;
}

// 默认设置
// stickerFolder: 默认为空字符串，需要用户选择
// defaultSize: 默认50像素
export const DEFAULT_SETTINGS: StickerPackageSettings = {
    stickerFolder: '',
    defaultSize: 50
};

// 表情包选择模态框
// 继承自Obsidian的Modal类，用于显示表情包选择界面
export class StickerModal extends Modal {
    plugin: StickerPackagePlugin; // 插件实例
    stickerFiles: TFile[] = []; // 存储找到的表情包文件
    searchInput: HTMLInputElement; // 搜索输入框
    stickerContainer: HTMLElement; // 表情包展示容器
    onChoose: (file: TFile) => void; // 选择表情包后的回调函数

    // 构造函数
    // app: Obsidian应用实例
    // plugin: 插件实例
    // onChoose: 选择表情包后的回调函数
    constructor(app: App, plugin: StickerPackagePlugin, onChoose: (file: TFile) => void) {
        super(app);
        this.plugin = plugin;
        this.onChoose = onChoose;
    }

    // 模态框打开时的回调函数
    async onOpen() {
        const { contentEl } = this;

        // 创建搜索框
        contentEl.addClass('sticker-package-modal'); // 添加CSS类
        const searchContainer = contentEl.createDiv();
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: '搜索表情包...',
            cls: 'sticker-package-search'
        });
        // 监听输入事件，实时更新表情包列表
        this.searchInput.addEventListener('input', () => this.updateStickerList());

        // 创建表情包容器
        this.stickerContainer = contentEl.createDiv({ cls: 'sticker-package-grid' });

        // 加载表情包
        await this.loadStickers();
    }

    // 加载表情包文件
    async loadStickers() {
        // 检查是否设置了表情包目录
        if (!this.plugin.settings.stickerFolder) {
            this.stickerContainer.createEl('div', { text: '请先在设置中选择表情包目录' });
            return;
        }

        // 获取表情包文件夹
        const folder = this.app.vault.getAbstractFileByPath(this.plugin.settings.stickerFolder);
        if (!(folder instanceof TFolder)) {
            this.stickerContainer.createEl('div', { text: '无法加载表情包目录' });
            return;
        }

        // 过滤出图片文件
        this.stickerFiles = folder.children.filter(file => 
            file instanceof TFile && 
            ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(file.extension.toLowerCase())
        ) as TFile[];

        // 更新表情包列表显示
        this.updateStickerList();
    }

    // 更新表情包列表显示
    // 根据搜索关键词过滤表情包并显示
    updateStickerList() {
        this.stickerContainer.empty(); // 清空容器
        const searchTerm = this.searchInput.value.toLowerCase(); // 获取搜索关键词

        // 过滤表情包文件
        const filteredStickers = this.stickerFiles.filter(file =>
            file.basename.toLowerCase().includes(searchTerm)
        );

        // 遍历并创建表情包元素
        for (const file of filteredStickers) {
            const stickerItem = this.stickerContainer.createDiv({ cls: 'sticker-package-item' });
            // 创建表情包图片
            const img = stickerItem.createEl('img', {
                cls: 'sticker-preview',
                attr: {
                    src: this.app.vault.getResourcePath(file), // 获取图片资源路径
                    alt: file.basename // 设置alt文本
                }
            });

            // 点击事件处理
            stickerItem.addEventListener('click', () => {
                this.onChoose(file); // 调用选择回调
                this.close(); // 关闭模态框
            });

            // 添加表情包名称
            stickerItem.createEl('div', {
                cls: 'sticker-name',
                text: file.basename
            });
        }
    }

    // 模态框关闭时的回调函数
    onClose() {
        const { contentEl } = this;
        contentEl.empty(); // 清空内容
    }
}

// 插件主类
export default class StickerPackagePlugin extends Plugin {
	settings: StickerPackageSettings; // 插件设置

	// 插件加载时的回调函数
	async onload() {
		await this.loadSettings(); // 加载设置

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
                            // 创建并打开表情包选择模态框
                            new StickerModal(this.app, this, (file) => {
                                const pos = editor.getCursor(); // 获取光标位置
                                // 插入表情包链接，格式为 ![[path|size]]
                                editor.replaceRange(`![[${file.path}|${this.settings.defaultSize}]]`, pos);
                            }).open();
						});
				});
			})
		);
	}

	// 加载设置
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// 保存设置
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// 插件设置页面
export class StickerPackageSettingTab extends PluginSettingTab {
    plugin: StickerPackagePlugin; // 插件实例

    constructor(app: App, plugin: StickerPackagePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // 显示设置页面
    display(): void {
        const { containerEl } = this;
        containerEl.empty(); // 清空容器

        containerEl.createEl('h2', { text: '表情包设置' }); // 添加标题

        // 表情包目录设置项
        new Setting(containerEl)
            .setName('表情包目录')
            .setDesc('选择存放表情包图片的目录')
            .addDropdown(dropdown => {
                // 获取所有文件夹
                const folders = this.app.vault.getAllLoadedFiles()
                    .filter((f: any) => f instanceof TFolder)
                    .map((f: any) => f.path);
                
                // 添加下拉选项
                dropdown
                    .addOptions({'': '请选择目录', ...Object.fromEntries(folders.map((f: any) => [f, f]))}) 
                    .setValue(this.plugin.settings.stickerFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.stickerFolder = value; // 更新设置
                        await this.plugin.saveSettings(); // 保存设置
                    });
            });

        // 默认尺寸设置项
        new Setting(containerEl)
            .setName('表情包默认尺寸')
            .setDesc('设置插入表情包时的默认尺寸（像素）')
            .addText(text => text
                .setPlaceholder('50')
                .setValue(String(this.plugin.settings.defaultSize))
                .onChange(async (value) => {
                    const size = parseInt(value) || 50; // 解析尺寸，默认为50
                    this.plugin.settings.defaultSize = size; // 更新设置
                    await this.plugin.saveSettings(); // 保存设置
                }));
    }
}
