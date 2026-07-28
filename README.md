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
TELEGRAM_POLLING=false
TELEGRAM_WEBHOOK_SECRET=replace-with-random-webhook-secret
TELEGRAM_ADMIN_SECRET=replace-with-random-admin-secret
PUBLIC_URL=https://ri-opal.vercel.app
```

## Routes

- `GET /health` checks the DBMS Gateway connection.
- `GET /debug/config` shows redacted runtime config for debugging.
- `POST /chat` accepts `{ "message": "hello" }` and returns `{ "reply": "..." }`.
- `POST /telegram/webhook` receives Telegram updates.
- `POST /telegram/set-webhook?secret=TELEGRAM_ADMIN_SECRET` registers `PUBLIC_URL/telegram/webhook` with Telegram.
- `GET /telegram/status?secret=TELEGRAM_ADMIN_SECRET` checks Telegram webhook status.

## Telegram Setup

After deploying the env vars to Vercel, call:

```sh
curl -X POST "https://ri-opal.vercel.app/telegram/set-webhook?secret=YOUR_TELEGRAM_ADMIN_SECRET"
```

Then send a message to the bot in Telegram. Telegram will call `/telegram/webhook`, RI will generate a reply with OpenAI, and the backend will send the response back to the chat.
