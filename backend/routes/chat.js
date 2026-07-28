const express = require("express");

function createChatRouter({ imageService, memoryStore, riChat }) {
  const router = express.Router();

  async function handleChatFlow(req, res) {
    const { conversationId = "api:default", message } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    try {
      if (imageService.isImageRequest(message)) {
        let prompt = imageService.extractImagePrompt(message);
        if (!prompt) {
          prompt = await imageService.buildPromptFromConversation({
            conversationId,
            memoryStore,
            request: message
          });
        }
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
  router.delete("/flow", async (req, res) => {
    const conversationId = req.body?.conversationId || req.query.conversationId || "api:default";

    try {
      await memoryStore.clearConversation(conversationId);
      return res.json({ ok: true, conversationId, cleared: true });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  });

  return router;
}

module.exports = {
  createChatRouter
};
