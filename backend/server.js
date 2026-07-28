require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const OpenAI = require("openai");
const TelegramBot = require("node-telegram-bot-api");
const db = require("./db");
const { RI_SYSTEM_PROMPT, buildRiMessages } = require("./ri-profile");

const app = express();
const port = Number(process.env.PORT || 5050);
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

app.set("trust proxy", true);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());

app.get("/health", async (req, res) => {
  if (!hasFullApiKey(process.env.API_KEY)) {
    return res.status(400).json({
      ok: false,
      error:
        "API_KEY must be the full key shown once when generated. The dashboard project list only shows key prefixes."
    });
  }

  try {
    const status = await db.status();
    return res.json({ ok: true, gateway: status });
  } catch (error) {
    return res.status(503).json({ ok: false, error: error.message });
  }
});

app.get("/debug/config", (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  res.json({
    ok: true,
    port,
    siteId: process.env.SITE_ID || null,
    dbmsUrl: process.env.DBMS_URL || "http://localhost:4000",
    dbmsApiKey: maskSecret(process.env.API_KEY),
    openaiModel,
    openaiApiKey: maskSecret(process.env.OPENAI_API_KEY),
    riPersonalityLoaded: Boolean(RI_SYSTEM_PROMPT),
    telegramBotToken: maskSecret(process.env.TELEGRAM_BOT_TOKEN),
    telegramPollingEnabled: shouldStartTelegramBot(),
    telegramWebhookSecret: maskSecret(process.env.TELEGRAM_WEBHOOK_SECRET),
    publicUrl: getPublicUrl(req)
  });
});

app.post("/chat", async (req, res) => {
  const { message } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const reply = await createRiReply(message);
    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/telegram/webhook", async (req, res) => {
  if (!isTelegramWebhookAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    await handleTelegramUpdate(req.body);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook failed:", error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/telegram/set-webhook", async (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const baseUrl = getPublicUrl(req);
    const webhookUrl = `${baseUrl}/telegram/webhook`;
    const result = await telegramApi("setWebhook", {
      url: webhookUrl,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
      allowed_updates: ["message"]
    });

    return res.json({ ok: true, webhookUrl, telegram: result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/telegram/status", async (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const result = await telegramApi("getWebhookInfo");
    return res.json({ ok: true, telegram: result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/db/ping", async (req, res) => {
  try {
    const rows = await db.query("SELECT 1 AS ok");
    return res.json({ ok: true, rows });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

startTelegramBot();

if (require.main === module) {
  const server = app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Set PORT to another value.`);
      process.exit(1);
    }

    throw error;
  });
}

function hasFullApiKey(value) {
  return typeof value === "string" && value.startsWith("dbms_") && value.length > 30;
}

async function createRiReply(message) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: openaiModel,
    messages: buildRiMessages(message)
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

async function handleTelegramUpdate(update) {
  const message = update?.message;
  if (!message) return;

  const chatId = message.chat?.id;
  const text = message.text;
  if (!chatId) return;

  if (!text || text.startsWith("/start")) {
    await sendTelegramMessage(chatId, "RI is online. Send a message to chat.");
    return;
  }

  const reply = await createRiReply(text);
  await sendTelegramMessage(chatId, reply || "I did not get a response.");
}

function startTelegramBot() {
  if (!shouldStartTelegramBot()) return;

  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith("/start")) {
      return bot.sendMessage(chatId, "RI is online. Send a message to chat.");
    }

    try {
      const reply = await createRiReply(text);
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

function shouldStartTelegramBot() {
  return (
    Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
    process.env.TELEGRAM_POLLING === "true" &&
    !process.env.VERCEL
  );
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

function isTelegramWebhookAuthorized(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.get("x-telegram-bot-api-secret-token") === secret;
}

function isAdminAuthorized(req) {
  const secret = process.env.TELEGRAM_ADMIN_SECRET;
  if (!secret) return true;
  return req.get("x-admin-secret") === secret || req.query.secret === secret;
}

function getPublicUrl(req) {
  const configuredUrl = process.env.PUBLIC_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configuredUrl) return normalizeUrl(configuredUrl);
  return `${req.protocol}://${req.get("host")}`;
}

function normalizeUrl(url) {
  return String(url || "").replace(/\/$/, "");
}

function maskSecret(value) {
  if (!value) return null;
  if (value.length <= 10) return "***";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

module.exports = app;
