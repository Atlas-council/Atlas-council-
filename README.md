# Atlas Council

A small web app that asks multiple independent AI providers for an initial answer, runs a cross-model critique round, and asks Chronos (OpenAI) to write a balanced final synthesis.

## Important setup and safety

- This is a starter app, not a hosted website. It runs on your computer until deployed.
- Model API calls may cost money and have provider-specific account and age requirements. Because this can involve paid accounts and billing, ask a parent/guardian or another trusted adult to review and manage any provider accounts, API keys, and spending limits.
- Never put API keys in `public/`, browser JavaScript, screenshots, source-control repositories, or messages. Keep them only in the server-side `.env` file.
- Start with two providers to test. Each debate calls every connected model twice, plus OpenAI once for the final synthesis, so costs can add up quickly.
- Models can make mistakes, agree for the wrong reasons, or produce outdated claims. The council is a learning aid, not a source of guaranteed truth.

## Run locally

1. Install a current Node.js LTS release.
2. Open a terminal in this folder and run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add API keys and confirm model names using each provider's current documentation. You do not need to connect every provider.
5. Run `npm start`.
6. Open `http://localhost:3000` in your browser.

## Providers supported

- OpenAI Chat Completions
- Anthropic Messages
- Google Gemini `generateContent`
- DeepSeek Chat Completions
- xAI Chat Completions

Provider model names and availability change. Check the official docs before setting the model variables:

- OpenAI: https://developers.openai.com/api/reference/chat-completions/overview
- Anthropic: https://platform.claude.com/docs/en/api/overview
- Gemini: https://ai.google.dev/api/generate-content
- DeepSeek: https://api-docs.deepseek.com/api/create-chat-completion/
- xAI: https://docs.x.ai/developers/rest-api-reference/inference/chat-completions

## Debate design

1. Independent round: every connected provider answers the same question.
2. Critique round: each provider receives the panel's first-round answers and critiques them.
3. Moderator: OpenAI/Chronos synthesizes areas of agreement, disagreement, uncertainty, and useful follow-up questions.

The app requests concise conclusions and reasons, not private hidden reasoning.
