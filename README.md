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
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1024x1024
```

Required for image upload:

```sh
CLOUDINARY_CLOUD_NAME=replace-with-cloudinary-cloud-name
CLOUDINARY_API_KEY=replace-with-cloudinary-api-key
CLOUDINARY_API_SECRET=replace-with-cloudinary-api-secret
CLOUDINARY_FOLDER=ri/generated
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
- `GET /` confirms RI is working.
- `GET /debug/config` shows redacted runtime config for debugging.
- `POST /chat/flow` accepts `{ "message": "hello" }` and returns `{ "reply": "..." }`.
- `POST /chat/flow` can also generate images with prompts like `{ "message": "/image a fantasy spider city" }`.
- `DELETE /chat/flow?conversationId=api:default` clears stored chat memory for a conversation.
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

RI keeps recent conversation memory per Telegram chat through the DBMS Gateway when available, with an in-memory fallback for local development. To generate an image in Telegram, send:

```txt
/image a fantasy anime spider queen city at sunset
```

RI generates the image with OpenAI, uploads it to Cloudinary, and sends the Cloudinary image URL back as a Telegram photo.

Telegram shows persistent `Home` and `Clear chat` buttons. Tap `Home` any time to see RI status/help, and tap `Clear chat` to delete RI's memory for your Telegram conversation.
