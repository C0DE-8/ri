const express = require("express");

function createChatRouter({ riChat }) {
  const router = express.Router();

  async function handleChatFlow(req, res) {
    const { message } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    try {
      const reply = await riChat.reply(message);
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
