const express = require("express");

function createChatRouter({ imageService, riChat }) {
  const router = express.Router();

  async function handleChatFlow(req, res) {
    const { conversationId = "api:default", message } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    try {
      if (imageService.isImageRequest(message)) {
        const prompt = imageService.extractImagePrompt(message);
        if (!prompt) return res.status(400).json({ error: "image prompt is required" });

        const image = await imageService.generate(prompt);
        return res.json({ type: "image", image });
      }

      const reply = await riChat.reply(message, { conversationId });
      return res.json({ reply });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  router.post("/flow", handleChatFlow);
  router.post("/", handleChatFlow);

  return router;
}

module.exports = {
  createChatRouter
};
