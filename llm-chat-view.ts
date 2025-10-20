import { ItemView, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_LLM_CHAT = 'llm-chat-view';

export class LLMChatView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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

    const wrapper = content.createEl('div', {
      cls: 'llm-chat-view__placeholder',
    });

    wrapper.createEl('h2', { text: 'LLM Chat placeholder' });
    wrapper.createEl('p', {
      text:
        'This is where the chat interface will live. Provide a prompt and display responses here.',
    });
  }

  async onClose(): Promise<void> {
    // nothing to clean up yet; placeholder implementation
  }
}
