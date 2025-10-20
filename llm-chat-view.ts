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
      cls: 'llm-chat-view',
    });

    const header = wrapper.createEl('div', {
      cls: 'llm-chat-view__header',
    });

    header.createEl('h2', {
      text: 'LLM Chat',
      cls: 'llm-chat-view__title',
    });

    const closeButton = header.createEl('button', {
      text: 'X',
      cls: 'llm-chat-view__close-button',
      attr: { 'aria-label': 'Collapse chat view' },
    });

    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      this.collapseSidebar();
    });

    const placeholder = wrapper.createEl('div', {
      cls: 'llm-chat-view__placeholder',
    });
    const currentFile = this.app.workspace.getActiveFile();
    placeholder.createEl('p', {
      text:
        'This is where the chat interface will live. Collapse the view with the X button without ending the session.' + 
        ' Current file: ' + (currentFile ? currentFile.path : 'No file open'),
    });
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
