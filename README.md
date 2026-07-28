# ri

RI is an AI chat backend powered by OpenAI, with DBMS Gateway database access and Telegram bot webhook support.

## Backend

```sh
cd backend
npm install
npm run dev
```

## Environment

Use `backend/.env.example` as the shape for local and Vercel environment variables.

Required for AI chat:

```sh
OPENAI_API_KEY=replace-with-openai-api-key
OPENAI_MODEL=gpt-4o-mini
```

Required for Telegram:

```sh
TELEGRAM_BOT_TOKEN=replace-with-telegram-bot-token
TELEGRAM_ALLOWED_CHAT_IDS=1300403822
TELEGRAM_POLLING=false
PUBLIC_URL=https://ri-opal.vercel.app
```

## Routes

- `GET /health` checks the DBMS Gateway connection.
- `GET /debug/config` shows redacted runtime config for debugging.
- `POST /chat/flow` accepts `{ "message": "hello" }` and returns `{ "reply": "..." }`.
- `POST /chat` is kept as a compatibility alias for the same flow.
- `POST /telegram/webhook` receives Telegram updates.
- `POST /telegram/set-webhook` registers `PUBLIC_URL/telegram/webhook` with Telegram.
- `GET /telegram/status` checks Telegram webhook status.

## Telegram Setup

After deploying the env vars to Vercel, call:

```sh
curl -X POST "https://ri-opal.vercel.app/telegram/set-webhook"
```

Then send a message to the bot in Telegram. Telegram will call `/telegram/webhook`, RI will generate a reply with OpenAI, and the backend will send the response back to the chat.

`TELEGRAM_ALLOWED_CHAT_IDS` limits RI to only replying in your approved Telegram chats. The current configured chat ID is `1300403822`.
