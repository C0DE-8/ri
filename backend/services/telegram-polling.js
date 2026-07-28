const TelegramBot = require("node-telegram-bot-api");

function startTelegramPolling({ riChat }) {
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
      const reply = await riChat.reply(text);
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
