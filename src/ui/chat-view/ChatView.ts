import { ItemView, WorkspaceLeaf, type App } from 'obsidian';
import { mount, unmount } from 'svelte';
import ChatViewComponent from './ChatView.svelte';
import type CortexPlugin from '../../../main';

export const VIEW_TYPE_CHAT = 'cortex-chat-view';

export class ChatView extends ItemView {
    private component: ReturnType<typeof mount> | null = null;
    private plugin: CortexPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: CortexPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_CHAT;
    }

    getDisplayText(): string {
        return 'Cortex Chat';
    }

    getIcon(): string {
        return 'message-circle';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();

        // 设置容器样式确保高度 100%
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        // 创建一个挂载点
        const mountPoint = container.createDiv({
            cls: 'cortex-chat-view-container',
        });
        mountPoint.style.height = '100%';
        mountPoint.style.display = 'flex';
        mountPoint.style.flexDirection = 'column';

        // 检测是否为暗色主题
        const isDarkMode = document.body.classList.contains('theme-dark');

        // 挂载 Svelte 组件
        this.component = mount(ChatViewComponent, {
            target: mountPoint,
            props: {
                plugin: this.plugin,
                isDarkMode,
            },
        });
    }

    async onClose(): Promise<void> {
        // 卸载 Svelte 组件
        if (this.component) {
            unmount(this.component);
            this.component = null;
        }
    }
}

/**
 * 注册 ChatView 到 Obsidian 插件
 */
export function registerChatView(plugin: CortexPlugin): void {
    plugin.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, plugin));
}

/**
 * 激活/打开 ChatView
 */
export async function activateChatView(app: App): Promise<void> {
    const { workspace } = app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];

    if (!leaf) {
        const rightLeaf = workspace.getRightLeaf(false);
        if (rightLeaf) {
            leaf = rightLeaf;
            await leaf.setViewState({
                type: VIEW_TYPE_CHAT,
                active: true,
            });
        }
    }

    if (leaf) {
        workspace.revealLeaf(leaf);
    }
}
