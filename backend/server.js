require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const db = require("./db");
const { RI_SYSTEM_PROMPT } = require("./profiles/ri");
const {
  createImageService,
  extractImagePrompt,
  isImageRequest
} = require("./services/image-service");
const { createMemoryStore } = require("./services/memory-store");
const { createRiChatService } = require("./services/ri-chat");
const {
  getAllowedTelegramChatIds,
  shouldStartTelegramPolling,
  startTelegramPolling
} = require("./services/telegram-polling");
const { createChatRouter } = require("./routes/chat");
const { createTelegramRouter } = require("./routes/telegram");
const { hasFullApiKey } = require("./utils/auth");
const { getPublicUrl, maskSecret } = require("./utils/http");

const app = express();
const port = Number(process.env.PORT || 5050);
const imageService = {
  ...createImageService(),
  extractImagePrompt,
  isImageRequest
};
const memoryStore = createMemoryStore({ db });
const riChat = createRiChatService({ memoryStore });

app.set("trust proxy", true);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    name: "RI",
    status: "working",
    message: "RI is working."
  });
});

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
  res.json({
    ok: true,
    port,
    siteId: process.env.SITE_ID || null,
    dbmsUrl: process.env.DBMS_URL || "http://localhost:4000",
    dbmsApiKey: maskSecret(process.env.API_KEY),
    openaiModel: riChat.model,
    openaiImageModel: imageService.model,
    openaiApiKey: maskSecret(process.env.OPENAI_API_KEY),
    riPersonalityLoaded: Boolean(RI_SYSTEM_PROMPT),
    memoryEnabled: true,
    cloudinaryConfigured: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    ),
    telegramBotToken: maskSecret(process.env.TELEGRAM_BOT_TOKEN),
    telegramPollingEnabled: shouldStartTelegramPolling(),
    telegramAllowedChatIds: getAllowedTelegramChatIds(),
    publicUrl: getPublicUrl(req)
  });
});

app.use("/chat", createChatRouter({ imageService, memoryStore, riChat }));

app.use(
  "/telegram",
  createTelegramRouter({
    imageService,
    memoryStore,
    riChat,
    getPublicUrl
  })
);

app.get("/db/ping", async (req, res) => {
  try {
    const rows = await db.query("SELECT 1 AS ok");
    return res.json({ ok: true, rows });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

startTelegramPolling({ imageService, memoryStore, riChat });

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

module.exports = app;
