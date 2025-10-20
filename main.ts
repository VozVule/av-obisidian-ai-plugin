import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { LLMChatView, VIEW_TYPE_LLM_CHAT } from './llm-chat-view';

interface ObsidianAiSettings {
	apiKey: string;
}

const DEFAULT_SETTINGS: ObsidianAiSettings = {
	apiKey: 'TEST-API-KEY',
};

export default class ObsidianAiPlugin extends Plugin {
	settings: ObsidianAiSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_LLM_CHAT, (leaf) => new LLMChatView(leaf));

		// when clicked on the robot icon, open the LLM chat view sidebar
		const robotRibbonIcon = this.addRibbonIcon('bot', 'Robot helper', () => {
			this.activateView(VIEW_TYPE_LLM_CHAT);
		});
		robotRibbonIcon.addClass('obsidian-ai-robot-ribbon');
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_LLM_CHAT);
	}

	async activateView(viewName: string) {
		const workspace = this.app.workspace;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(viewName);
		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			// create a new leaf in the right sidebar for our custom view
			leaf = workspace.getRightLeaf(false);
			if (!leaf) {
				new Notice(`Unable to open view ${viewName}`)
			}
			await leaf?.setViewState({type: viewName, active: true});
		}
		workspace.revealLeaf(leaf!);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
