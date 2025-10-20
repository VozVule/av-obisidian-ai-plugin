# Obsidian AI Reviewer

A lightweight chat sidebar that lets you query OpenAI's major release models (GPT-4 family, o-series, GPT-5 preview) about the active file in Obsidian. The model receives the entire file as context and responds in line with a concise review-oriented system prompt.

## Features
- Chat with an AI assistant about the *current* file using Obsidian's right sidebar.
- Conversation history within the session so you can follow up on previous answers.
- Quick new-chat button to reset the conversation while staying in the same view.
- Model selector fed by `config.json`, ordered from lighter GPT-4/ o-series variants up to heavier GPT-5 preview options.
- Minimal UI designed to stay out of the way while you work in the editor.

## Requirements
- Obsidian 1.4+
- OpenAI API key with access to the `gpt-4.1-nano` family or better
- Node.js 18+ for development/build steps

## Installation
1. Clone or download this repository into `<vault>/.obsidian/plugins/av-obisidian-ai-plugin`.
2. Run `npm install` followed by `npm run build` to produce `main.js`.
3. In Obsidian, enable **Community plugins**, then toggle on **Obsidian AI Reviewer**.

## Configuring your API key
The plugin stores secrets in its private data file rather than in version-controlled code.

1. After enabling the plugin once, Obsidian creates `data.json` inside the plugin folder.
2. Edit that file and insert your key:

```json
{
  "apiKey": "sk-your-openai-key"
}
```

In a later release, the settings tab will let you paste the key through the UI. Until then, editing `data.json` manually is the quickest route.

## Choosing a model
- Use the dropdown at the top of the chat sidebar to pick the OpenAI model for the current session.
- The list of options is defined in `config.json`; each entry only needs an `id` and optional `size`:

```json
{
  "models": [
    { "id": "gpt-4o-mini", "size": "small" },
    { "id": "gpt-4o", "size": "medium" },
    { "id": "o4", "size": "large" }
  ]
}
```

- Edit the file (and rebuild) to tailor the catalogue to your account.
- Switching models clears the current conversation so responses stay focused and consistent.

## Usage
- Open a Markdown file, then click the robot ribbon icon to reveal the chat view.
- Ask the assistant about the file—e.g. "Is the introduction clear?" or "What should I fix here?".
- The assistant only knows about the active file; switching files and asking again will re-read the new file.
- Click `+` in the chat header to clear the conversation and start a fresh exchange.

## Development
- `npm run dev` — watch mode for iterating on TypeScript/ESBuild output
- `npm run build` — production bundle

The main code lives in:
- `main.ts` for plugin lifecycle and view registration
- `llm-chat-view.ts` for the sidebar view
- `chat/chat-component.ts` for chat UI and state
- `ai-connector.ts` for OpenAI requests
- `config.json` for the list of available OpenAI models

## Roadmap & ideas
- Settings tab for managing the API key and prompt tweaks
- Streaming responses to reduce perceived latency
- Persisted chat history per file

## License
MIT
