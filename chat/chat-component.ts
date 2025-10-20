import { Notice, TFile } from 'obsidian';
import type ObsidianAiPlugin from '../main';
import { AiConnector, ConnectorChatMessage } from '../ai-connector';

interface ChatComponentOptions {
  onNewContext?: (path: string | null) => void;
}

export class ChatComponent {
  private readonly containerEl: HTMLElement;
  private readonly plugin: ObsidianAiPlugin;
  private readonly options?: ChatComponentOptions;
  private connector?: AiConnector;
  private apiKeySignature: string | null = null;

  private rootEl?: HTMLElement;
  private contextEl?: HTMLElement;
  private messagesEl?: HTMLElement;
  private inputEl?: HTMLTextAreaElement;
  private sendButton?: HTMLButtonElement;

  private conversation: ConnectorChatMessage[] = [];
  private isSending = false;
  private contextPath: string | null = null;

  constructor(containerEl: HTMLElement, plugin: ObsidianAiPlugin, options?: ChatComponentOptions) {
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.options = options;
  }

  render(): void {
    this.clear();

    const root = this.containerEl.createDiv({ cls: 'llm-chat' });
    const context = root.createDiv({ cls: 'llm-chat__context' });
    const messages = root.createDiv({ cls: 'llm-chat__messages' });
    const form = root.createEl('form', { cls: 'llm-chat__form' });

    const textarea = form.createEl('textarea', {
      cls: 'llm-chat__input',
      attr: {
        rows: '3',
        placeholder: 'Ask the LLM about the current file...',
      },
    });

    const sendButton = form.createEl('button', {
      cls: 'llm-chat__send-button',
      text: 'Send',
      attr: { type: 'submit' },
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.handleSubmit();
    });

    this.rootEl = root;
    this.contextEl = context;
    this.messagesEl = messages;
    this.inputEl = textarea;
    this.sendButton = sendButton;

    this.updateContextLabel();
  }

  resetConversation(): void {
    this.conversation = [];
    this.contextPath = null;
    this.messagesEl?.empty();
    this.updateContextLabel();
    if (this.inputEl) {
      this.inputEl.value = '';
    }
  }

  private async handleSubmit(): Promise<void> {
    if (this.isSending) {
      return;
    }

    const trimmedMessage = this.inputEl?.value.trim();
    if (!trimmedMessage) {
      new Notice('Enter a question before sending.');
      return;
    }

    const file = this.getActiveFile();
    if (!file) {
      new Notice('Open a file to use as context for the chat.');
      return;
    }

    let fileContent: string;
    try {
      fileContent = await this.plugin.app.vault.read(file);
    } catch (error) {
      console.error('Failed to read active file content', error);
      new Notice('Could not read the active file.');
      return;
    }

    const history = this.conversation.slice();
    const userEntryEl = this.appendMessage('user', trimmedMessage);
    this.conversation.push({ role: 'user', content: trimmedMessage });

    this.inputEl!.value = '';
    this.setSendingState(true);
    this.setContextPath(file.path);

    try {
      const connector = this.getConnector();
      const response = await connector.sendMessage({
        fileContent,
        userMessage: trimmedMessage,
        history,
      });

      const assistantMessage = response.message || 'I was not able to produce a response.';
      this.conversation.push({ role: 'assistant', content: assistantMessage });
      this.appendMessage('assistant', assistantMessage);
    } catch (error) {
      console.error('OpenAI request failed', error);
      new Notice(error instanceof Error ? error.message : 'Request failed.');
      userEntryEl?.remove();
      this.conversation.pop();
    } finally {
      this.setSendingState(false);
    }
  }

  private appendMessage(role: ConnectorChatMessage['role'], content: string): HTMLElement | null {
    if (!this.messagesEl) {
      return null;
    }

    const wrapper = this.messagesEl.createDiv({
      cls: `llm-chat__message llm-chat__message--${role}`,
    });

    wrapper.createDiv({
      cls: 'llm-chat__message-role',
      text: role === 'user' ? 'You' : 'Assistant',
    });

    wrapper.createDiv({
      cls: 'llm-chat__message-content',
      text: content,
    });

    wrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return wrapper;
  }

  private clear(): void {
    this.containerEl.empty();
  }

  private getConnector(): AiConnector {
    const currentKey = this.plugin.settings?.apiKey ?? '';
    if (this.connector && this.apiKeySignature === currentKey) {
      return this.connector;
    }

    this.connector = AiConnector.fromSettings(this.plugin.settings);
    this.apiKeySignature = currentKey;
    return this.connector;
  }

  private getActiveFile(): TFile | null {
    return this.plugin.app.workspace.getActiveFile();
  }

  private setSendingState(value: boolean): void {
    this.isSending = value;
    if (this.inputEl) {
      this.inputEl.disabled = value;
    }
    if (this.sendButton) {
      this.sendButton.toggleClass('is-loading', value);
      this.sendButton.disabled = value;
      this.sendButton.textContent = value ? 'Sending...' : 'Send';
    }
  }

  private setContextPath(path: string): void {
    this.contextPath = path;
    this.options?.onNewContext?.(path);
    this.updateContextLabel();
  }

  private updateContextLabel(): void {
    if (!this.contextEl) {
      return;
    }

    this.contextEl.setText(
      this.contextPath ? `Context: ${this.contextPath}` : 'Context: No file selected',
    );
  }
}
