import { ItemView, WorkspaceLeaf } from "obsidian";
import AgentView from "./AgentView.svelte";
import type { AgentManager } from "../../agent/agent-manager";
import type { ProviderManager } from "../../providers/provider-manager";
import type { PluginSettings } from "../../types";

export const VIEW_TYPE_AGENT = "cortex-agent-view";

export class AgentViewLeaf extends ItemView {
	private svelteComponent: ReturnType<typeof import("svelte").mount> | null =
		null;
	private agentManager: AgentManager;
	private providerManager: ProviderManager;
	private getSettings: () => PluginSettings;

	constructor(
		leaf: WorkspaceLeaf,
		agentManager: AgentManager,
		providerManager: ProviderManager,
		getSettings: () => PluginSettings
	) {
		super(leaf);
		this.agentManager = agentManager;
		this.providerManager = providerManager;
		this.getSettings = getSettings;
	}

	getViewType(): string {
		return VIEW_TYPE_AGENT;
	}
	getDisplayText(): string {
		return "Cortex Agents";
	}
	getIcon(): string {
		return "bot";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("cortex-agent-container");
		const { mount } = await import("svelte");
		const Comp = AgentView as unknown as Parameters<typeof mount>[0];
		this.svelteComponent = mount(Comp, {
			target: this.contentEl,
			props: {
				agentManager: this.agentManager,
				providerManager: this.providerManager,
				getSettings: this.getSettings,
				workspaceLeaf: this.leaf,
				app: this.app,
			},
		});
	}

	async onClose(): Promise<void> {
		if (this.svelteComponent) {
			const { unmount } = await import("svelte");
			unmount(this.svelteComponent);
			this.svelteComponent = null;
		}
	}
}
