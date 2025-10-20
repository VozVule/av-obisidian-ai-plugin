import { ItemView, WorkspaceLeaf } from 'obsidian';
import { ChatComponent } from './chat/chat-component';
import type ObsidianAiPlugin from './main';

export const VIEW_TYPE_LLM_CHAT = 'llm-chat-view';

export class LLMChatView extends ItemView {
  private readonly plugin: ObsidianAiPlugin;
  private chatComponent: ChatComponent | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ObsidianAiPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_LLM_CHAT;
  }

  getDisplayText(): string {
    return 'LLM Chat';
  }

  getIcon(): string {
    return 'bot';
  }

  async onOpen(): Promise<void> {
    const content = this.containerEl.children[1];
    content.empty();

    // setup all the DOM elements for the chat view
    const wrapper = content.createEl('div', {
      cls: 'llm-chat-view',
    });

    const header = wrapper.createEl('div', {
      cls: 'llm-chat-view__header',
    });

    header.createEl('h2', {
      text: 'LLM Chat',
      cls: 'llm-chat-view__title',
    });

    const actions = header.createDiv({ cls: 'llm-chat-view__actions' });

    const newChatButton = actions.createEl('button', {
      text: '+',
      cls: 'llm-chat-view__action-button',
      attr: { 'aria-label': 'Start new chat session' },
    });

    const closeButton = actions.createEl('button', {
      text: '×',
      cls: 'llm-chat-view__action-button',
      attr: { 'aria-label': 'Collapse chat view' },
    });

    newChatButton.addEventListener('click', (event) => {
      event.preventDefault();
      this.chatComponent?.resetConversation();
    });

    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      this.collapseSidebar();
    });

    // assign the chat component to the obsidian gui element
    const chatContainer = wrapper.createDiv({ cls: 'llm-chat-view__body' });
    this.chatComponent = new ChatComponent(chatContainer, this.plugin);
    this.chatComponent.render();
  }

  async onClose(): Promise<void> {
    // nothing to clean up yet; placeholder implementation
  }

  private collapseSidebar(): void {
    const { rightSplit } = this.app.workspace;
    if (!rightSplit) {
      return;
    }
    rightSplit.collapse();
  }
}
