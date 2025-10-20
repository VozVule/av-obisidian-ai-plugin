import type { ObsidianAiSettings } from './settings';

const DEFAULT_SYSTEM_PROMPT = [
  "You are an expert AI.",
  "Your sole purpose is to review the files given to you as context.",
  "If the user's file content is off, suggest changes; if it's fine you just say that everything is fine for now.",
  "Only dive deeper into the topic if the user specifically asks you to explain something or dive deeper."
].join(' ');

const DEFAULT_MODEL = 'gpt-4.1-nano';
const OPENAI_CHAT_COMPLETIONS_PATH = '/chat/completions';

export interface AiConnectorOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  systemPrompt?: string;
}

export interface ChatRequest {
  fileContent: string;
  userMessage: string;
  history?: ConnectorChatMessage[];
  model?: string;
}

export interface ChatResponse {
  message: string;
  raw: unknown;
}

type ChatCompletionRole = 'system' | 'user' | 'assistant';

interface ChatCompletionMessage {
  role: ChatCompletionRole;
  content: string;
}

export interface ConnectorChatMessage {
  role: Exclude<ChatCompletionRole, 'system'>;
  content: string;
}

export class AiConnector {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor({ apiKey, baseUrl, model, systemPrompt }: AiConnectorOptions) {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('Missing OpenAI API key. Please add it in the plugin settings.');
    }

    this.apiKey = apiKey.trim();
    this.baseUrl = (baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = model ?? DEFAULT_MODEL;
    this.systemPrompt = systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }

  static fromSettings(
    settings: ObsidianAiSettings,
    overrides: Partial<AiConnectorOptions> = {},
  ): AiConnector {
    return new AiConnector({ apiKey: settings.apiKey, ...overrides });
  }

  async sendMessage({
    fileContent,
    userMessage,
    history,
    model,
  }: ChatRequest): Promise<ChatResponse> {
    if (!userMessage || !userMessage.trim()) {
      throw new Error('User message cannot be empty.');
    }

    const messages = this.buildMessages({
      fileContent,
      userMessage,
      history,
    });

    const response = await fetch(this.baseUrl + OPENAI_CHAT_COMPLETIONS_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model?.trim() || this.model,
        messages,
        temperature: 0.2,
        response_format: { type: 'text' },
      }),
    });

    if (!response.ok) {
      const errorPayload = await this.safeParseJson(response);
      const errorMessage =
        typeof errorPayload?.error?.message === 'string'
          ? errorPayload.error.message
          : `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const payload = await response.json();
    const message =
      payload?.choices?.[0]?.message?.content?.toString().trim() ?? '';

    return {
      message,
      raw: payload,
    };
  }

  private buildMessages({
    fileContent,
    userMessage,
    history,
  }: ChatRequest): ChatCompletionMessage[] {
    const trimmedMessage = userMessage.trim();
    const contextBlock = this.formatFileBlock(fileContent);

    const messages: ChatCompletionMessage[] = [
      {
        role: 'system',
        content: `${this.systemPrompt}\n\n${contextBlock}`.trim(),
      },
    ];

    if (history?.length) {
      history.forEach((item) => {
        if (!item.content.trim()) {
          return;
        }
        messages.push({
          role: item.role,
          content: item.content.trim(),
        });
      });
    }

    messages.push({
      role: 'user',
      content: trimmedMessage,
    });

    return messages;
  }

  private formatFileBlock(content: string): string {
    const normalizedContent = content ?? '';
    const sanitizedContent = this.truncateContent(normalizedContent.trim());
    return ['Active file content:', '```', sanitizedContent, '```'].join('\n');
  }

  private truncateContent(content: string, maxLength = 4000): string {
    if (content.length <= maxLength) {
      return content;
    }

    const truncatedNotice = '\n...\n[Content truncated]\n';
    return content.slice(0, maxLength) + truncatedNotice;
  }

  private async safeParseJson(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch (error) {
      console.error('Failed to parse OpenAI error payload', error);
      return null;
    }
  }
}
