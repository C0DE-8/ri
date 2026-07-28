const TelegramBot = require("node-telegram-bot-api");

function startTelegramPolling({ imageService, memoryStore, riChat }) {
  if (!shouldStartTelegramPolling()) return;

  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!isAllowedTelegramChat(chatId)) return;

    if (!text || text.startsWith("/start")) {
      return bot.sendMessage(chatId, "RI is online. Send a message to chat.");
    }

    try {
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
          return bot.sendMessage(chatId, "Send an image prompt like: /image a fantasy spider city at sunset");
        }

        await bot.sendMessage(chatId, "Generating image...");
        const image = await imageService.generate(prompt);
        return bot.sendPhoto(chatId, image.url, { caption: prompt.slice(0, 1024) });
      }

      const reply = await riChat.reply(text, { conversationId: `telegram:${chatId}` });
      return bot.sendMessage(chatId, reply || "I did not get a response.");
    } catch (error) {
      console.error("Telegram reply failed:", error.message);
      return bot.sendMessage(chatId, "RI hit an error while replying.");
    }
  });

  bot.on("polling_error", (error) => {
    console.error("Telegram polling error:", error.message);
  });

  console.log("Telegram bot polling is enabled.");
}

function shouldStartTelegramPolling() {
  return (
    Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
    process.env.TELEGRAM_POLLING === "true" &&
    !process.env.VERCEL
  );
}

function getAllowedTelegramChatIds() {
  return String(process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAllowedTelegramChat(chatId) {
  const allowedChatIds = getAllowedTelegramChatIds();
  if (!allowedChatIds.length) return true;
  return allowedChatIds.includes(String(chatId));
}

module.exports = {
  startTelegramPolling,
  shouldStartTelegramPolling,
  getAllowedTelegramChatIds,
  isAllowedTelegramChat
};
