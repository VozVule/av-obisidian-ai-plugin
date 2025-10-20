import { Notice, TFile } from 'obsidian';
import type ObsidianAiPlugin from '../main';
import { AiConnector, ConnectorChatMessage } from '../ai-connector';
import modelConfig from '../config.json';

interface ModelConfigEntry {
  id: string;
  size?: string;
}

const SIZE_ORDER = ['small', 'medium', 'large', 'experimental'];

const MODEL_OPTIONS: ModelConfigEntry[] = Array.isArray((modelConfig as any)?.models)
  ? [...(modelConfig as any).models]
      .filter((entry: any): entry is ModelConfigEntry => entry && typeof entry.id === 'string')
      .sort((a, b) => {
        const sizeDiff = getSizeRank(a.size) - getSizeRank(b.size);
        if (sizeDiff !== 0) {
          return sizeDiff;
        }
        return a.id.localeCompare(b.id);
      })
  : [];

function getSizeRank(size?: string): number {
  if (!size) {
    return SIZE_ORDER.length;
  }
  const index = SIZE_ORDER.indexOf(size.toLowerCase());
  return index === -1 ? SIZE_ORDER.length : index;
}

function formatModelLabel(entry: ModelConfigEntry): string {
  if (!entry.size) {
    return entry.id;
  }
  return `${entry.id} (${entry.size})`;
}

interface ChatComponentOptions {
  onNewContext?: (path: string | null) => void;
}

export class ChatComponent {
  private readonly containerEl: HTMLElement;
  private readonly plugin: ObsidianAiPlugin;
  private readonly options?: ChatComponentOptions;
  private connector?: AiConnector;
  private connectorSignature: string | null = null;
  private readonly modelOptions: ModelConfigEntry[] = MODEL_OPTIONS;

  private rootEl?: HTMLElement;
  private contextEl?: HTMLElement;
  private modelSelectEl?: HTMLSelectElement;
  private messagesEl?: HTMLElement;
  private inputEl?: HTMLTextAreaElement;
  private sendButton?: HTMLButtonElement;

  private conversation: ConnectorChatMessage[] = [];
  private isSending = false;
  private contextPath: string | null = null;
  private selectedModel: string;

  constructor(containerEl: HTMLElement, plugin: ObsidianAiPlugin, options?: ChatComponentOptions) {
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.options = options;
    this.selectedModel = this.modelOptions[0]?.id ?? '';
  }

  render(): void {
    this.clear();

    const root = this.containerEl.createDiv({ cls: 'llm-chat' });
    const controls = root.createDiv({ cls: 'llm-chat__controls' });
    const context = controls.createDiv({ cls: 'llm-chat__context' });
    const modelWrapper = controls.createDiv({ cls: 'llm-chat__model' });

    modelWrapper.createEl('label', {
      cls: 'llm-chat__model-label',
      text: 'Model',
      attr: { for: 'llm-chat-model-select' },
    });

    const selectEl = modelWrapper.createEl('select', {
      cls: 'llm-chat__model-select',
      attr: { id: 'llm-chat-model-select' },
    });
    this.populateModelSelect(selectEl);

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
    this.modelSelectEl = selectEl;
    this.messagesEl = messages;
    this.inputEl = textarea;
    this.sendButton = sendButton;

    this.updateContextLabel();
  }

  private populateModelSelect(selectEl: HTMLSelectElement): void {
    selectEl.empty();

    if (!this.modelOptions.length) {
      const option = selectEl.createEl('option', {
        text: 'Default (connector)',
        attr: { value: '' },
      });
      option.selected = true;
      selectEl.disabled = true;
      return;
    }

    const desiredModel = this.selectedModel || this.modelOptions[0].id;

    this.modelOptions.forEach((entry) => {
      const option = selectEl.createEl('option', {
        text: formatModelLabel(entry),
        attr: { value: entry.id },
      });
      if (entry.id === desiredModel) {
        option.selected = true;
      }
    });

    this.selectedModel = desiredModel;
    selectEl.addEventListener('change', () => {
      const newValue = selectEl.value;
      this.handleModelChange(newValue);
    });
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
        model: this.selectedModel || undefined,
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

  private handleModelChange(modelId: string): void {
    if (this.selectedModel === modelId) {
      return;
    }

    this.selectedModel = modelId;
    if (this.modelSelectEl && this.modelSelectEl.value !== modelId) {
      this.modelSelectEl.value = modelId;
    }
    this.connectorSignature = null;
    this.conversation = [];
    this.messagesEl?.empty();
    this.updateContextLabel();
  }

  private getConnector(): AiConnector {
    const currentKey = this.plugin.settings?.apiKey ?? '';
    const signature = `${currentKey}::${this.selectedModel}`;

    if (this.connector && this.connectorSignature === signature) {
      return this.connector;
    }

    this.connector = AiConnector.fromSettings(this.plugin.settings, {
      model: this.selectedModel || undefined,
    });
    this.connectorSignature = signature;
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

    const contextText = this.contextPath
      ? `Context: ${this.contextPath}`
      : 'Context: No file selected';
    const modelLabel = this.getSelectedModelLabel();
    const combined = modelLabel ? `${contextText} · Model: ${modelLabel}` : contextText;
    this.contextEl.setText(combined);
  }

  private getSelectedModelLabel(): string {
    if (!this.selectedModel) {
      return '';
    }
    const match = this.modelOptions.find((entry) => entry.id === this.selectedModel);
    return match ? formatModelLabel(match) : this.selectedModel;
  }
}
