const express = require("express");
const { isAllowedTelegramChat } = require("../services/telegram-polling");

function createTelegramRouter({ riChat, getPublicUrl }) {
  const router = express.Router();

  router.post("/webhook", async (req, res) => {
    try {
      await handleTelegramUpdate(req.body, riChat);
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
        allowed_updates: ["message"]
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

async function handleTelegramUpdate(update, riChat) {
  const message = update?.message;
  if (!message) return;

  const chatId = message.chat?.id;
  const text = message.text;
  if (!chatId) return;
  if (!isAllowedTelegramChat(chatId)) return;

  if (!text || text.startsWith("/start")) {
    await sendTelegramMessage(chatId, "RI is online. Send a message to chat.");
    return;
  }

  const reply = await riChat.reply(text);
  await sendTelegramMessage(chatId, reply || "I did not get a response.");
}

async function sendTelegramMessage(chatId, text) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
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

module.exports = {
  createTelegramRouter,
  handleTelegramUpdate,
  sendTelegramMessage
};
