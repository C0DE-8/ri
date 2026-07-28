const express = require("express");
const { isAllowedTelegramChat } = require("../services/telegram-polling");
const { homeKeyboard, homeMessage } = require("../services/telegram-ui");

function createTelegramRouter({ imageService, memoryStore, riChat, getPublicUrl }) {
  const router = express.Router();

  router.post("/webhook", async (req, res) => {
    try {
      await handleTelegramUpdate(req.body, { imageService, memoryStore, riChat });
      return res.json({ ok: true });
    } catch (error) {
      console.error("Telegram webhook failed:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.post("/set-webhook", async (req, res) => {
    try {
      const baseUrl = getPublicUrl(req);
      const webhookUrl = `${baseUrl}/telegram/webhook`;
      const result = await telegramApi("setWebhook", {
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"]
      });

      return res.json({ ok: true, webhookUrl, telegram: result });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  router.get("/status", async (req, res) => {
    try {
      const result = await telegramApi("getWebhookInfo");
      return res.json({ ok: true, telegram: result });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  return router;
}

async function handleTelegramUpdate(update, { imageService, memoryStore, riChat }) {
  if (update?.callback_query) {
    await handleTelegramCallback(update.callback_query, memoryStore);
    return;
  }

  const message = update?.message;
  if (!message) return;

  const chatId = message.chat?.id;
  const text = message.text;
  if (!chatId) return;
  if (!isAllowedTelegramChat(chatId)) return;

  if (!text || text.startsWith("/start") || text.toLowerCase() === "home") {
    await sendTelegramMessage(chatId, homeMessage(), homeKeyboard());
    return;
  }

  if (text === "/clear" || text.toLowerCase() === "clear chat") {
    await clearTelegramChat(chatId, memoryStore);
    await sendTelegramMessage(chatId, "Chat memory cleared.", homeKeyboard());
    return;
  }

  if (imageService.isImageRequest(text)) {
    const conversationId = `telegram:${chatId}`;
    let prompt = imageService.extractImagePrompt(text);
    if (!prompt) {
      prompt = await imageService.buildPromptFromConversation({
        conversationId,
        memoryStore,
        request: text
      });
    }

    if (!prompt) {
      await sendTelegramMessage(chatId, "Send an image prompt like: /image a fantasy spider city at sunset");
      return;
    }

    await sendTelegramMessage(chatId, "Generating image...");
    const image = await imageService.generate(prompt);
    await sendTelegramPhoto(chatId, image.url, prompt);
    return;
  }

  const reply = await riChat.reply(text, { conversationId: `telegram:${chatId}` });
  await sendTelegramMessage(chatId, reply || "I did not get a response.");
}

async function handleTelegramCallback(callbackQuery, memoryStore) {
  const chatId = callbackQuery.message?.chat?.id;
  if (!chatId) return;
  if (!isAllowedTelegramChat(chatId)) return;

  if (callbackQuery.data === "clear_chat") {
    await clearTelegramChat(chatId, memoryStore);
    await answerCallbackQuery(callbackQuery.id, "Chat memory cleared.");
    await sendTelegramMessage(chatId, "Chat memory cleared.", homeKeyboard());
  }
}

async function clearTelegramChat(chatId, memoryStore) {
  await memoryStore.clearConversation(`telegram:${chatId}`);
}

async function sendTelegramMessage(chatId, text, replyMarkup) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    reply_markup: replyMarkup
  });
}

async function sendTelegramPhoto(chatId, photo, caption) {
  return telegramApi("sendPhoto", {
    chat_id: chatId,
    photo,
    caption: caption ? caption.slice(0, 1024) : undefined,
    reply_markup: homeKeyboard()
  });
}

async function telegramApi(method, body) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.description || `Telegram ${method} failed with ${response.status}`);
  }

  return payload.result;
}

async function answerCallbackQuery(callbackQueryId, text) {
  return telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text
  });
}

module.exports = {
  createTelegramRouter,
  handleTelegramUpdate,
  sendTelegramMessage,
  sendTelegramPhoto
};
